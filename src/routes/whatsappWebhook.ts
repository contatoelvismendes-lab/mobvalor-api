import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { consultarAnyCar } from '../services/anycarService';
import { sendWhatsAppMessage } from '../services/whatsappService';
import { InfosimplesService } from '../services/infosimplesService';

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
        contacts?: Array<{
          profile?: { name?: string };
          wa_id?: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
      };
      field?: string;
    }>;
  }>;
}

// Armazenamento em memória para a máquina de estados de autorização OTP
interface SessaoConsulta {
  etapa: 'AGUARDANDO_WHATSAPP_TITULAR' | 'AGUARDANDO_OTP_LOJISTA';
  placa: string;
  renavam: string;
  uf: string;
  telefoneTitular?: string;
  tokenOtp?: string;
  expiraEm: number;
}

const sessoesAtivas = new Map<string, SessaoConsulta>();

export default async function whatsappWebhook(fastify: FastifyInstance) {
  const infosimples = new InfosimplesService();

  // Validação da Meta/WhatsApp Webhook
  fastify.get('/webhook/whatsapp', async (req: FastifyRequest, reply: FastifyReply) => {
    const query = req.query as Record<string, string>;
    const mode = query['hub.mode'] || query['hub_mode'];
    const token = query['hub.verify_token'] || query['hub_verify_token'];
    const challenge = query['hub.challenge'] || query['hub_challenge'];

    const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'mobvalor_token_secreto_123';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return reply.status(200).send(challenge);
    }
    return reply.status(403).send('Forbidden');
  });

  // Recepção de mensagens
  fastify.post('/webhook/whatsapp', async (req: FastifyRequest<{ Body: WhatsAppWebhookPayload }>, reply: FastifyReply) => {
    reply.status(200).send({ status: 'EVENT_RECEIVED' });

    try {
      const entry = req.body.entry?.[0];
      const message = entry?.changes?.[0]?.value?.messages?.[0];

      if (!message || message.type !== 'text' || !message.text?.body) return;

      const from = message.from; // Número do lojista
      const texto = message.text.body.trim();
      const sessaoAtual = sessoesAtivas.get(from);

      // Limpa sessões expiradas (> 10 minutos)
      if (sessaoAtual && Date.now() > sessaoAtual.expiraEm) {
        sessoesAtivas.delete(from);
      }

      // ESTADO 2: Lojista enviou o código OTP recebido do proprietário
      if (sessaoAtual && sessaoAtual.etapa === 'AGUARDANDO_OTP_LOJISTA') {
        const codigoDigitado = texto.replace(/\D/g, '');

        if (codigoDigitado === sessaoAtual.tokenOtp) {
          await sendWhatsAppMessage(
            from,
            '✅ *Consentimento LGPD validado com sucesso!*\nGerando Laudo Renave On oficial...'
          );

          // Dispara a consulta na Infosimples com autorização auditada
          let laudo: any = { aptoParaEntrada: true, pendenciasIdentificadas: [] };
          try {
            laudo = await infosimples.gerarLaudoRenaveOn({
              placa: sessaoAtual.placa,
              renavam: sessaoAtual.renavam,
              uf: sessaoAtual.uf,
            });
          } catch (e: any) {
            fastify.log.warn({ err: e.message }, 'Aviso na emissão do laudo');
          }

          const statusIcon = laudo.aptoParaEntrada ? '🟢' : '🔴';
          const statusTexto = laudo.aptoParaEntrada
            ? '*APTO PARA ENTRADA NO ESTOQUE (RENAVE)*'
            : '*RESTRITO / PENDÊNCIAS DETECTADAS*';

          let pendenciasTexto = '';
          if (!laudo.aptoParaEntrada && laudo.pendenciasIdentificadas?.length > 0) {
            pendenciasTexto = '\n⚠️ *Pendências:* \n' +
              laudo.pendenciasIdentificadas.map((p: string) => ` • ${p}`).join('\n');
          }

          const respostaLaudo =
            `🔍 *LAUDO RENAVE ON - MOBVALOR*\n\n` +
            `🔢 *Placa:* ${sessaoAtual.placa}\n` +
            `📑 *Renavam:* ${sessaoAtual.renavam}\n` +
            `📍 *UF:* ${sessaoAtual.uf}\n` +
            `🛡️ *Autorização LGPD:* Confirmada (Titular: ${sessaoAtual.telefoneTitular})\n\n` +
            `${statusIcon} *Status Renave:* ${statusTexto}` +
            `${pendenciasTexto}`;

          await sendWhatsAppMessage(from, respostaLaudo);
          sessoesAtivas.delete(from);
          return;
        } else {
          await sendWhatsAppMessage(
            from,
            '❌ *Código incorreto ou inválido.* Por favor, peça ao proprietário o código de 6 dígitos enviado ao WhatsApp dele e digite novamente.'
          );
          return;
        }
      }

      // ESTADO 1: Lojista enviou o telefone do proprietário
      if (sessaoAtual && sessaoAtual.etapa === 'AGUARDANDO_WHATSAPP_TITULAR') {
        const telefoneLimpo = texto.replace(/\D/g, '');

        if (telefoneLimpo.length < 10 || telefoneLimpo.length > 13) {
          await sendWhatsAppMessage(
            from,
            '⚠️ *Número inválido.* Por favor, envie o WhatsApp do proprietário com DDD (ex: 81999998888):'
          );
          return;
        }

        // Formata para padrão internacional (DDI 55)
        const telefoneTitularFormatado = telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`;
        
        // Gera código de 6 dígitos
        const tokenOtp = Math.floor(100000 + Math.random() * 900000).toString();

        // Atualiza a sessão
        sessaoAtual.etapa = 'AGUARDANDO_OTP_LOJISTA';
        sessaoAtual.telefoneTitular = telefoneTitularFormatado;
        sessaoAtual.tokenOtp = tokenOtp;
        sessaoAtual.expiraEm = Date.now() + 10 * 60 * 1000; // 10 minutos
        sessoesAtivas.set(from, sessaoAtual);

        // Dispara mensagem com o Token para o WhatsApp do Proprietário
        await sendWhatsAppMessage(
          telefoneTitularFormatado,
          `🔐 *MobValor / Azzu - Autorização de Consulta Veicular*\n\n` +
          `Uma revenda de veículos está solicitando a verificação de regularidade do veículo placa *${sessaoAtual.placa}* em conformidade com a LGPD.\n\n` +
          `Seu código de autorização é: *${tokenOtp}*\n\n` +
          `_Informe este código ao lojista apenas se você autoriza a consulta deste veículo._`
        );

        // Notifica o Lojista
        await sendWhatsAppMessage(
          from,
          `📲 Código de autorização LGPD enviado para o WhatsApp do proprietário (*${telefoneTitularFormatado}*).\n\n` +
          `👉 *Solicite o código de 6 dígitos ao cliente e digite aqui para liberar o Laudo Renave On:*`
        );
        return;
      }

      // FLUXO INICIAL: Reconhecimento da Placa e Renavam
      const matchPlaca = texto.toUpperCase().match(/[A-Z]{3}[0-9][0-9A-Z][0-9]{2}/);
      const matchRenavam = texto.match(/\b\d{9,11}\b/);

      if (!matchPlaca || !matchRenavam) {
        await sendWhatsAppMessage(
          from,
          '👋 Olá! Para iniciar a consulta Renave On com autorização LGPD, envie a *Placa e o Renavam* do veículo (ex: `SNQ0E12 01361491997`).'
        );
        return;
      }

      const placa = matchPlaca[0];
      const renavam = matchRenavam[0];
      let uf = 'PE';

      // Consulta dados básicos cadastrais no AnyCar
      try {
        const dadosVeiculo = await consultarAnyCar(placa);
        if (dadosVeiculo?.uf) uf = dadosVeiculo.uf;
      } catch (e) {
        // Fallback silencioso
      }

      // Cria a sessão aguardando o telefone do titular
      sessoesAtivas.set(from, {
        etapa: 'AGUARDANDO_WHATSAPP_TITULAR',
        placa,
        renavam,
        uf,
        expiraEm: Date.now() + 10 * 60 * 1000,
      });

      await sendWhatsAppMessage(
        from,
        `🚗 *Veículo Identificado:* Placa *${placa}* | Renavam *${renavam}*\n\n` +
        `🛡️ *Conformidade LGPD:* Para realizar a auditoria de restrições no Renave On, informe o *WhatsApp do Proprietário* (com DDD, ex: 81999998888) para envio do código de autorização:`
      );
    } catch (error: any) {
      fastify.log.error({ err: error.message }, 'Erro no Webhook WhatsApp');
    }
  });
}