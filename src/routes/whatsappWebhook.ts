import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { consultarAnyCar } from '../services/anycarService';
import { sendWhatsAppMessage } from '../services/whatsappService';

export default async function whatsappWebhook(fastify: FastifyInstance) {
  // 1. Verificação do Webhook pela Meta (GET)
  fastify.get('/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
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

  // 2. Recebimento de Mensagens do WhatsApp (POST)
  fastify.post('/webhook', async (req: FastifyRequest, reply: FastifyReply) => {
    const body = req.body as any;

    // Responde 200 imediatamente para a Meta não ficar reprocessando
    reply.status(200).send({ status: 'EVENT_RECEIVED' });

    try {
      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (!message || message.type !== 'text') {
        return;
      }

      const from = message.from;
      const userText = message.text.body.trim().toUpperCase();

      // Regex para identificar formato de placas (Mercosul ou antiga)
      const placaRegex = /[A-Z]{3}[0-9][0-9A-Z][0-9]{2}/g;
      const match = userText.match(placaRegex);

      if (!match) {
        await sendWhatsAppMessage(
          from,
          '🚗 Olá! Bem-vindo à *Mobvalor*.\n\nEnvie a *placa* do veículo (ex: *ABC1D23*) que você deseja consultar.'
        );
        return;
      }

      const placa = match[0];
      await sendWhatsAppMessage(from, `🔍 Localizando dados para a placa *${placa}* na base AnyCar... Aguarde um instante.`);

      // Consulta de dados básicos na AnyCar
      const dados = await consultarAnyCar('veicular-dados-basicos', placa);

      // Formatação dos dados retornados
      const resposta =
        `📋 *Resultado da Consulta - Mobvalor*\n\n` +
        `🚗 *Veículo:* ${dados?.marca || ''} ${dados?.modelo || 'Não identificado'}\n` +
        `🔢 *Placa:* ${placa}\n` +
        `📅 *Ano/Mod:* ${dados?.anoFabricacao || '-'}/${dados?.anoModelo || '-'}\n` +
        `🎨 *Cor:* ${dados?.cor || '-'}\n` +
        `⛽ *Combustível:* ${dados?.combustivel || '-'}\n` +
        `🏷️ *Status:* Ativo\n\n` +
        `Deseja consultar o histórico de sinistro, leilão ou FIPE?`;

      await sendWhatsAppMessage(from, resposta);
    } catch (error: any) {
      fastify.log.error({ err: error.message }, 'Erro ao processar mensagem do WhatsApp');
    }
  });
}