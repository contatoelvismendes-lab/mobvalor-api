import type { FastifyPluginAsync } from 'fastify';
import { supabase } from '../config/supabase';
import apiVeicular from '../services/apiVeicular';
import infinitePay from '../services/infinitePay';

type WhatsAppBody = {
  telefone?: string;
  mensagem?: string;
};

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;

const money = (value: number | string): string => {
  if (typeof value === 'string' && value === 'N/A') return value;
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const vehicleLabel = (vehicle: Record<string, unknown>, keys: string[]): string => {
  const value = keys.map((key) => vehicle[key]).find((item) => item !== undefined && item !== null);
  return value ? String(value) : 'N/A';
};

const gerarRecargaRenave = async (tenantId: string): Promise<string> => {
  const cobranca = await infinitePay.gerarCobrancaPix(tenantId, 'RENAVE_10');
  return [
    '💳 Recarga Renave ON',
    `Valor: ${money(cobranca.valor)}`,
    `Link de pagamento: ${cobranca.link_pagamento}`,
    `Pix Copia e Cola: ${cobranca.pix_copia_e_cola}`,
    `Pedido: ${cobranca.order_nsu}`,
    'Após a confirmação do pagamento, seus 10 créditos serão liberados automaticamente.',
  ].join('\n');
};

export const whatsappRoutes: FastifyPluginAsync = async (app) => {
  app.get('/whatsapp', async (request, reply) => {
    const query = request.query as {
      'hub.mode'?: string;
      'hub.challenge'?: string;
      'hub.verify_token'?: string;
    };

    if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== process.env.META_VERIFY_TOKEN) {
      return reply.code(403).send('Token de verificação inválido');
    }

    return reply.code(200).send(query['hub.challenge'] ?? '');
  });

  app.post('/whatsapp', async (request) => {
    const { telefone, mensagem } = request.body as WhatsAppBody;
    const phone = telefone?.trim();
    const text = mensagem?.trim() ?? '';
    const leilaoMatch = text.match(/^LEIL[AÃ]O\s+(.+)$/i);
    const placa = (leilaoMatch?.[1] ?? text).trim().toUpperCase();
    const isLeilaoCheck = Boolean(leilaoMatch);

    if (!phone) {
      return 'Informe o telefone para gerar sua cobrança Pix.';
    }

    if (/^RECARREGAR$/i.test(text)) {
      const rechargeUser = await supabase.from('users').select('tenant_id').eq('telefone', phone).maybeSingle();
      if (rechargeUser.error) throw rechargeUser.error;
      if (!rechargeUser.data?.tenant_id) return 'Faça uma consulta primeiro para vincular seu telefone a uma loja.';
      return gerarRecargaRenave(rechargeUser.data.tenant_id);
    }

    if (!placa) {
      return 'Informe telefone e placa. Exemplo: BRA2E19';
    }

    if (!PLACA_REGEX.test(placa)) {
      return 'Envie uma placa válida no formato antigo ou Mercosul. Exemplo: BRA2E19';
    }

    let user = await supabase
      .from('users')
      .select('id, tenant_id, tenants(*)')
      .eq('telefone', phone)
      .maybeSingle();

    if (user.error) throw user.error;

    let userId = user.data?.id;
    let tenantId = user.data?.tenant_id;
    let tenant = Array.isArray(user.data?.tenants) ? user.data.tenants[0] : user.data?.tenants;

    if (!user.data) {
      const createdTenant = await supabase
        .from('tenants')
        .insert({ nome_loja: `WhatsApp ${phone}`, saldo_renave_on: 1, saldo_leilao_check: 1 })
        .select('id, saldo_renave_on, saldo_leilao_check')
        .single();

      if (createdTenant.error) throw createdTenant.error;

      const createdUser = await supabase
        .from('users')
        .insert({ nome: `Cliente ${phone}`, telefone: phone, telefone_whatsapp: phone, tenant_id: createdTenant.data.id })
        .select('id, tenant_id')
        .single();

      if (createdUser.error) throw createdUser.error;

      userId = createdUser.data.id;
      tenantId = createdUser.data.tenant_id;
      tenant = createdTenant.data;
    }

    if (isLeilaoCheck) {
      const saldo = Number(tenant?.saldo_leilao_check ?? 0);
      if (saldo <= 0) {
        return gerarRecargaRenave(tenantId);
      }

      const consulta = await apiVeicular.consultarLeilaoCheck(placa);
      const novoSaldo = saldo - 1;
      const updatedTenant = await supabase
        .from('tenants')
        .update({ saldo_leilao_check: novoSaldo })
        .eq('id', tenantId);

      if (updatedTenant.error) throw updatedTenant.error;

      const savedConsulta = await supabase.from('consultas').insert({
        user_id: userId,
        tenant_id: tenantId,
        placa,
        tipo_consulta: 'LEILAO_CHECK',
      });

      if (savedConsulta.error) throw savedConsulta.error;

      const risco = consulta.possuiSinistro || consulta.classificacaoMonta !== 'Sem Indício de Monta'
        ? '🔴 Atenção: há indício de risco estrutural ou sinistro.'
        : '🟢 Sem indício de monta ou sinistro informado.';
      return [
        `🔎 Leilão Check - ${consulta.placa}`,
        `Histórico de leilão: ${consulta.possuiLeilao ? '✅ Sim' : '❌ Não'}`,
        consulta.possuiLeilao ? `Tipo: ${consulta.tipoLeilao}` : '',
        consulta.possuiLeilao ? `Comitente: ${consulta.comitente}` : '',
        consulta.possuiLeilao ? `Lote: ${consulta.lote} | Data: ${consulta.dataLeilao}` : '',
        `Sinistro: ${consulta.possuiSinistro ? '⚠️ Sim' : '✅ Não'}`,
        `Classificação de monta: ${consulta.classificacaoMonta}`,
        risco,
        `Deságio sugerido: ${consulta.desagioSugeridoPct}%`,
        `Parecer comercial: ${consulta.parecerComercial}`,
        `Saldo restante: ${novoSaldo} crédito(s)`,
      ].filter(Boolean).join('\n');
    }

    const saldo = Number(tenant?.saldo_renave_on ?? 0);
    if (saldo <= 0) {
      return gerarRecargaRenave(tenantId);
    }

    const consulta = await apiVeicular.consultarRenaveON(placa);
    const novoSaldo = saldo - 1;

    const updatedTenant = await supabase
      .from('tenants')
      .update({ saldo_renave_on: novoSaldo })
      .eq('id', tenantId);

    if (updatedTenant.error) throw updatedTenant.error;

    const savedConsulta = await supabase.from('consultas').insert({
      user_id: userId,
      tenant_id: tenantId,
      placa,
      tipo_consulta: 'renave_on',
    });

    if (savedConsulta.error) throw savedConsulta.error;

    const apto = consulta.semaforo === true || /apto|verde/i.test(String(consulta.semaforo));
    return [
      `Consulta Renave ON - ${placa}`,
      `Veículo: ${vehicleLabel(consulta.veiculo, ['marca', 'brand'])} ${vehicleLabel(consulta.veiculo, ['modelo', 'model'])}`,
      `Ano: ${vehicleLabel(consulta.veiculo, ['ano', 'year'])}`,
      `Semáforo Renave: ${apto ? '🟢 Apto' : '🔴 Bloqueio'}`,
      `Total de débitos: ${money(consulta.totalDebitos)}`,
      `FIPE: ${money(consulta.fipe)}`,
      `Saldo restante: ${novoSaldo} crédito(s)`,
    ].join('\n');

  });
};
