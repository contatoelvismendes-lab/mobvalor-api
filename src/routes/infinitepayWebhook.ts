import type { FastifyPluginAsync } from 'fastify';
import { supabase } from '../config/supabase';
import { PACOTES } from '../services/infinitePay';

export const infinitepayWebhook: FastifyPluginAsync = async (app) => {
  app.post('/infinitepay', async (request, reply) => {
    const body = request.body as {
      order_nsu?: string;
      status?: string;
      transaction_nsu?: string;
    };
    const orderNsu = body.order_nsu?.trim();
    const status = body.status?.toUpperCase();

    if (!orderNsu || !status) {
      return reply.code(400).send({ success: false, message: 'order_nsu e status são obrigatórios' });
    }

    if (status !== 'PAID' && status !== 'APPROVED') {
      return reply.code(200).send({ success: true, message: 'Evento recebido' });
    }

    const recarga = await supabase
      .from('recargas')
      .select('*')
      .eq('order_nsu', orderNsu)
      .maybeSingle();

    if (recarga.error) throw recarga.error;
    if (!recarga.data) {
      return reply.code(404).send({ success: false, message: 'Recarga não encontrada' });
    }
    if (String(recarga.data.status).toUpperCase() !== 'PENDING') {
      return reply.code(200).send({ success: true, message: 'Recarga já processada' });
    }

    const updated = await supabase.from('recargas').update({
      status: 'PAID',
      paid_at: new Date().toISOString(),
    }).eq('order_nsu', orderNsu).eq('status', 'PENDING');
    if (updated.error) throw updated.error;

    const pacote = PACOTES[recarga.data.pacote_tipo as keyof typeof PACOTES];
    if (!pacote) return reply.code(400).send({ success: false, message: 'Tipo de pacote inválido' });
    const saldo = pacote.saldo;
    const creditos = pacote.creditos;
    const tenant = await supabase.from('tenants').select(saldo).eq('id', recarga.data.tenant_id).single();
    if (tenant.error) throw tenant.error;

    const saldoAtual = Number((tenant.data as Record<string, unknown>)[saldo] ?? 0);
    const tenantUpdate = await supabase.from('tenants').update({ [saldo]: saldoAtual + creditos }).eq('id', recarga.data.tenant_id);
    if (tenantUpdate.error) throw tenantUpdate.error;

    return reply.code(200).send({ success: true, message: 'Créditos liberados com sucesso' });
  });
};
