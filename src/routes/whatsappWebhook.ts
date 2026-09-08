import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

interface WhatsAppWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          text?: {
            body: string;
          };
          type: string;
          interactive?: {
            type: string;
            button_reply?: {
              id: string;
              title: string;
            };
          };
        }>;
      };
    }>;
  }>;
}

// Função auxiliar para enviar mensagens via WhatsApp Cloud API
async function sendWhatsAppMessage(to: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    console.error('⚠️ Credenciais do WhatsApp não configuradas no .env');
    return;
  }

  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: text },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem do WhatsApp:', error.response?.data || error.message);
  }
}

// Função para enviar menu interativo com botões
async function sendWhatsAppInteractiveMenu(to: string, walletBalance: number) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) return;

  const formattedBalance = walletBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  try {
    await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          header: {
            type: 'text',
            text: '🚗 *MobValor - Consulta Renave On*'
          },
          body: {
            text: `Olá! Seu saldo atual em carteira é de *${formattedBalance}*.\n\nEscolha uma das opções abaixo para continuar:`
          },
          footer: {
            text: 'Selecione uma opção'
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'btn_consultar_placa',
                  title: 'Consultar Veículo'
                }
              },
              {
                type: 'reply',
                reply: {
                  id: 'btn_ver_saldo',
                  title: 'Meu Saldo'
                }
              }
            ]
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error: any) {
    console.error('❌ Erro ao enviar menu interativo:', error.response?.data || error.message);
  }
}

export async function whatsappWebhookRoutes(fastify: FastifyInstance) {
  // Rota de verificação do Webhook (GET)
  fastify.get('/webhook/whatsapp', async (req: FastifyRequest, reply: FastifyReply) => {
    const mode = (req.query as any)['hub.mode'];
    const token = (req.query as any)['hub.verify_token'];
    const challenge = (req.query as any)['hub.challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mobvalor_verify_token';

    if (mode && token === VERIFY_TOKEN) {
      return reply.code(200).send(challenge);
    }
    return reply.code(403).send('Token de verificação inválido');
  });

  // Recepção de mensagens do WhatsApp (POST)
  fastify.post('/webhook/whatsapp', async (req: FastifyRequest<{ Body: WhatsAppWebhookPayload }>, reply: FastifyReply) => {
    reply.status(200).send({ status: 'EVENT_RECEIVED' });

    try {
      const entry = req.body.entry?.[0];
      const message = entry?.changes?.[0]?.value?.messages?.[0];

      console.log('--- WEBHOOK WHATSAPP RECEBIDO ---');
      console.log('Payload messages:', JSON.stringify(message));

      if (!message) {
        console.log('Mensagem ignorada: objeto message vazio.');
        return;
      }

      const from = message.from;

      // Trata cliques em botões interativos
      if (message.type === 'interactive' && message.interactive?.button_reply) {
        const buttonId = message.interactive.button_reply.id;
        console.log(`Botão clicado por ${from}: ${buttonId}`);

        const dealer = await prisma.dealer.findUnique({
          where: { whatsappNumber: from }
        });

        if (!dealer) {
          await sendWhatsAppMessage(from, '❌ Revenda não encontrada.');
          return;
        }

        if (buttonId === 'btn_ver_saldo') {
const saldo = `R$ ${Number(dealer.walletBalance).toFixed(2).replace('.', ',')}`;
          await sendWhatsAppMessage(from, `💰 Seu saldo atual em carteira é de *${saldo}*.`);
        } else if (buttonId === 'btn_consultar_placa') {
          await sendWhatsAppMessage(from, '📝 Por favor, envie apenas a **Placa** do veículo que deseja consultar (ex: SNQ0E12).');
        }
        return;
      }

      // Trata mensagens de texto comuns
      if (message.type === 'text' && message.text?.body) {
        const texto = message.text.body.trim();
        console.log(`De: ${from} | Texto: ${texto}`);

        // 1. Busca a revenda no banco pelo número de WhatsApp
        const dealer = await prisma.dealer.findUnique({
          where: { whatsappNumber: from }
        });

        if (!dealer) {
          console.log(`⚠️ Dealer não encontrado para o número: ${from}`);
          await sendWhatsAppMessage(
            from,
            '❌ *Acesso não autorizado.*\nSeu número de WhatsApp não está cadastrado como revenda ativa no MobValor.'
          );
          return;
        }

        console.log(`✅ Dealer encontrado: ${dealer.id} - Saldo: ${dealer.walletBalance}`);

        // Se o usuário mandou apenas a placa (ex: formato de placa 7 dígitos ABC1D23 ou ABC1234)
        const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i;
        if (placaRegex.test(texto)) {
          // Envia o menu interativo com o saldo atualizado da revenda
          await sendWhatsAppInteractiveMenu(from, Number(dealer.walletBalance));
          return;
        } else {
          await sendWhatsAppMessage(
            from,
            '👋 Olá! Para iniciar a consulta Renave On, envie apenas a **Placa** do veículo (ex: SNQ0E12).'
          );
          return;
        }
      }

    } catch (error) {
      console.error('❌ Erro crítico no processamento do webhook do WhatsApp:', error);
    }
  });
}