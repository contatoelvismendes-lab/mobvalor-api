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

      // Identificador de placas (Mercosul ou antiga)
      const placaRegex = /[A-Z]{3}[0-9][0-9A-Z][0-9]{2}/g;
      const match = userText.match(placaRegex);

      if (!match) {
        await sendWhatsAppMessage(
          from,
          '🚗 Olá! Bem-vindo à *Mobvalor*.\n\nEnvie a *placa* do veículo para consultar a ficha cadastral e o status de aptidão para o *Renave*.'
        );
        return;
      }

      const placa = match[0];
      await sendWhatsAppMessage(from, `🔍 Analisando dados e elegibilidade *Renave* para a placa *${placa}*...`);

      // 1. Consulta Cadastral Avançada (Traz Marca, Modelo, UF, Município, etc.)
      const resAvancada = await consultarAnyCar('veicular-dados-avancados', placa);
      const dados = resAvancada?.dados || resAvancada?.data || resAvancada || {};

      console.log('--- RETORNO ANYCAR AVANCADO ---', JSON.stringify(dados, null, 2));

      // Função auxiliar de extração
      const extrairTexto = (campo: any): string => {
        if (!campo) return '';
        if (typeof campo === 'string' || typeof campo === 'number') return String(campo).trim();
        if (typeof campo === 'object') {
          return String(campo.nome || campo.descricao || campo.valor || campo.name || campo.modelo || '').trim();
        }
        return '';
      };

      const marca = extrairTexto(dados?.marca);
      const modelo = extrairTexto(dados?.modelo);
      const marcaModelo = extrairTexto(dados?.marca_modelo || dados?.marcaModelo);
      const veiculo = marcaModelo || `${marca} ${modelo}`.trim() || 'Veículo identificado';

      const anoFab = extrairTexto(dados?.ano_fabricacao || dados?.anoFabricacao || dados?.ano) || '-';
      const anoMod = extrairTexto(dados?.ano_modelo || dados?.anoModelo || dados?.modelo_ano) || '-';
      const cor = extrairTexto(dados?.cor || dados?.cor_veiculo) || '-';
      const combustivel = extrairTexto(dados?.combustivel || dados?.tipo_combustivel) || '-';
      const municipioUf = `${extrairTexto(dados?.municipio) || ''} - ${extrairTexto(dados?.uf) || ''}`.trim().replace(/^-|-$/, '') || 'Brasil';

      // Validações impeditivas do Renave
      const restricoes = dados?.restricoes || dados?.restricao || [];
      const possuiRestricao = Array.isArray(restricoes) ? restricoes.length > 0 : Boolean(dados?.possui_restricao);
      const possuiGravame = Boolean(dados?.gravame || dados?.alienacao);
      const possuiBloqueio = Boolean(dados?.bloqueio_judicial || dados?.renajud);

      let statusRenave = '✅ APTO PARA ENTRADA';
      let motivoBloqueio = '';

      if (possuiBloqueio) {
        statusRenave = '❌ INAPTO / BLOQUEIO JUDICIAL';
        motivoBloqueio = '\n⚠️ Consta bloqueio administrativo/judicial ativo.';
      } else if (possuiGravame) {
        statusRenave = '⚠️ ATENÇÃO / GRAVAME ATIVO';
        motivoBloqueio = '\n⚠️ Necessário baixa de alienação/gravame antes do estoque.';
      } else if (possuiRestricao) {
        statusRenave = '⚠️ ATENÇÃO / RESTRIÇÕES DIVERSAS';
        motivoBloqueio = '\n⚠️ Constam restrições cadastrais na base estadual.';
      }

      // Mensagem formatada completa
      const resposta =
        `📋 *Relatório Veicular & Renave - Mobvalor*\n\n` +
        `🚗 *Veículo:* ${veiculo}\n` +
        `🔢 *Placa:* ${placa}\n` +
        `📅 *Ano/Mod:* ${anoFab}/${anoMod}\n` +
        `🎨 *Cor:* ${cor}\n` +
        `⛽ *Combustível:* ${combustivel}\n` +
        `📍 *Localidade:* ${municipioUf}\n\n` +
        `🏢 *Status Renave:* ${statusRenave}${motivoBloqueio}\n\n` +
        `Deseja consultar a *FIPE atualizada* ou o histórico de *Leilão & Sinistro* deste veículo?`;

      await sendWhatsAppMessage(from, resposta);
    } catch (error: any) {
      fastify.log.error({ err: error.message }, 'Erro ao processar mensagem do WhatsApp');
    }
  });
}