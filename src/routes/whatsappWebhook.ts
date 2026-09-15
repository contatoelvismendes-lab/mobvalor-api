import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function sendWhatsAppText(to: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  await axios.post(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

async function sendWhatsAppButtons(to: string, bodyText: string, buttons: Array<{ id: string, title: string }>) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  await axios.post(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      }
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

export async function whatsappWebhookRoutes(app: FastifyInstance) {
  // Validação do webhook (GET)
  app.get('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const verifyToken = process.env.META_VERIFY_TOKEN;
    const query: any = request.query;

    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    console.log('🔍 Webhook validation received:');
    console.log(`   Mode: ${mode}`);
    console.log(`   Token match: ${token === verifyToken}`);
    console.log(`   Challenge: ${challenge?.slice(0, 10)}...`);

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook validado com sucesso!');
      return reply.status(200).send(challenge);
    }

    console.error('❌ Erro ao validar webhook');
    return reply.status(403).send({ error: 'Validation failed' });
  });

  // Recebimento de mensagens (POST) - Fluxo simplificado
  app.post('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const body: any = request.body;

    try {
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) return reply.status(200).send({ status: 'ignored' });

      const from = message.from;
      const msgType = message.type;
      let textContent = '';

      if (msgType === 'text') {
        textContent = message.text.body.trim().toLowerCase();
      } else if (msgType === 'interactive') {
        textContent = message.interactive.button_reply.id;
      } else {
        return reply.status(200).send({ status: 'unsupported_type' });
      }

      // Encontrar ou criar dealer
      let dealer = await prisma.dealer.findUnique({ where: { whatsapp: from } });

      if (!dealer) {
        console.log(`👤 Criando novo dealer: ${from}`);
        dealer = await prisma.dealer.create({
          data: {
            whatsapp: from,
            name: `Lojista ${from}`,
            email: `${from}@mobvalor.com`,
            balance: 10.0
          }
        });

        // Bem-vindo
        await sendWhatsAppText(
          from,
          `🚗 *Bem-vindo à Mobvalor!* 💜\n\nConsulte veículos com rapidez e segurança, direto por aqui.`
        );

        // Menu inicial
        await sendWhatsAppButtons(
          from,
          'O que você deseja fazer?',
          [
            { id: 'menu_consulta', title: '🔍 Nova Consulta' },
            { id: 'menu_suporte', title: '💬 Falar com Suporte' }
          ]
        );
        return reply.status(200).send({ status: 'ok' });
      }

      // Menu principal
      if (textContent === 'menu_consulta' || textContent.includes('consulta')) {
        await sendWhatsAppText(
          from,
          `🚗 *Nova Consulta*\n\nMe envie a placa do veículo que você quer consultar.\n\n*Ex.:* ABC-1234 ou ABC1D23\n\n💡 A qualquer momento, digite *cancelar* para voltar ao menu.`
        );
        return reply.status(200).send({ status: 'ok' });
      }

      if (textContent === 'menu_suporte' || textContent.includes('suporte')) {
        await sendWhatsAppText(
          from,
          `💬 *Falar com Suporte*\n\nNossa equipe está à disposição! Descreva sua solicitação abaixo.`
        );
        return reply.status(200).send({ status: 'ok' });
      }

      if (textContent === 'efetuar_consulta') {
        // Buscar dealer no banco
        const dealerData = await prisma.dealer.findUnique({ where: { whatsapp: from } });

        if (!dealerData) {
          await sendWhatsAppText(
            from,
            `❌ *Erro!* Dealer não encontrado. Tente novamente.`
          );
          return reply.status(200).send({ status: 'error' });
        }

        // Verificar se tem CNPJ/CPF e email
        if (!dealerData.document || !dealerData.email) {
          await sendWhatsAppText(
            from,
            `📋 *Cadastro Incompleto*\n\nPreciso de alguns dados para prosseguir:\n\n1️⃣ CNPJ ou CPF\n2️⃣ Email\n\n*Envie seu CNPJ ou CPF*`
          );
          // TODO: Salvar estado para próxima mensagem
          return reply.status(200).send({ status: 'ok' });
        }

        // Verificar saldo
        if (dealerData.balance < 47.90) {
          await sendWhatsAppText(
            from,
            `💰 *Saldo Insuficiente!*\n\nVocê tem: R$ ${dealerData.balance.toFixed(2)}\nNecessário: R$ 47,90\n\n*Deseja fazer uma recarga?* Digite *recarga* ou *cancelar*`
          );
          return reply.status(200).send({ status: 'ok' });
        }

        // Debitar e processar consulta
        await prisma.dealer.update({
          where: { whatsapp: from },
          data: { balance: dealerData.balance - 47.90 }
        });

        await sendWhatsAppText(
          from,
          `✅ *Consulta Processada!*\n\n💳 Débito de R$ 47,90 realizado\n💰 Saldo: R$ ${(dealerData.balance - 47.90).toFixed(2)}\n\n📋 A análise será entregue em breve!\n\n💜 Obrigado por usar a Mobvalor!`
        );

        setTimeout(async () => {
          await sendWhatsAppButtons(
            from,
            'O que você deseja fazer?',
            [
              { id: 'menu_consulta', title: '🔍 Nova Consulta' },
              { id: 'menu_suporte', title: '💬 Falar com Suporte' }
            ]
          );
        }, 2000);
        return reply.status(200).send({ status: 'ok' });
      }

      if (textContent === 'outras_consultas') {
        await sendWhatsAppText(
          from,
          `🚗 *Nova Consulta*\n\nMe envie a placa do veículo que você quer consultar.\n\n*Ex.:* ABC-1234 ou ABC1D23\n\n💡 A qualquer momento, digite *cancelar* para voltar ao menu.`
        );
        return reply.status(200).send({ status: 'ok' });
      }

      if (textContent === 'cancelar') {
        await sendWhatsAppButtons(
          from,
          'Voltando ao menu...\n\nO que você deseja fazer?',
          [
            { id: 'menu_consulta', title: '🔍 Nova Consulta' },
            { id: 'menu_suporte', title: '💬 Falar com Suporte' }
          ]
        );
        return reply.status(200).send({ status: 'ok' });
      }

      // Processar placa
      const cleanPlate = textContent.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      if (cleanPlate.length === 7) {
        await sendWhatsAppText(
          from,
          `🔍 *Consultando placa ${cleanPlate}...*\n\nAguarde um instante.`
        );

        // TODO: Integrar com API de consulta real
        const consultaMessage = `✅ Placa ${cleanPlate} recebida!\n\n💎 *Consulta Completa — R$ 47,90*\n\nO que está incluído:\n✅ Informações Cadastrais\n✅ Identificação Técnica\n✅ Histórico de Proprietários\n✅ Débitos\n✅ Restrições Judiciais\n✅ Roubo e Furto\n✅ Gravame\n✅ Alienações\n✅ Sinistros\n✅ Recalls\n✅ Registro em Locadora\n✅ Aceitação em Seguradoras\n✅ Score do Veículo\n✅ Histórico de KM\n✅ Diversas Informações`;

        await sendWhatsAppText(from, consultaMessage);

        // Botões de ação
        setTimeout(async () => {
          await sendWhatsAppButtons(
            from,
            'O que você deseja fazer?',
            [
              { id: 'efetuar_consulta', title: '✅ Efetuar Consulta' },
              { id: 'outras_consultas', title: '🔍 Outras Consultas' },
              { id: 'cancelar', title: '❌ Cancelar' }
            ]
          );
        }, 1500);
        return reply.status(200).send({ status: 'ok' });
      }

      // Mensagem não reconhecida
      await sendWhatsAppButtons(
        from,
        'Não entendi. O que você deseja fazer?',
        [
          { id: 'menu_consulta', title: '🔍 Nova Consulta' },
          { id: 'menu_suporte', title: '💬 Falar com Suporte' }
        ]
      );

      return reply.status(200).send({ status: 'success' });
    } catch (error) {
      console.error('❌ Erro crítico no webhook:', error);
      return reply.status(200).send({ status: 'error' });
    }
  });
}
