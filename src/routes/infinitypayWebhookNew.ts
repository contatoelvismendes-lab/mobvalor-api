import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RecargaService } from '../services/recargaService';
import { sendWhatsAppNotification } from '../services/whatsappService';
import { prisma } from '../lib/prisma';

export async function infinityPayWebhookNew(fastify: FastifyInstance) {
  fastify.post<{ Body: any }>(
    '/infinitypay/callback',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      try {
        const evento = request.body as any;

        console.log('🔔 Webhook InfinitePay recebido:');
        console.log(JSON.stringify(evento, null, 2));

        if (!evento?.event) {
          return reply.status(400).send({
            sucesso: false,
            mensagem: 'Evento não identificado',
          });
        }

        if (evento.event === 'payment.approved' || evento.event === 'payment.confirmed') {
          await procesarPagamentoAprovado(evento);
        } else if (evento.event === 'payment.pending') {
          console.log('⏳ Pagamento pendente, aguardando confirmação...');
        } else if (evento.event === 'payment.declined' || evento.event === 'payment.failed') {
          await procesarPagamentoRecusado(evento);
        }

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Webhook processado com sucesso',
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao processar webhook',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.post<{ Params: { id: string }; Body: any }>(
    '/recargas/:id/confirmar-pagamento',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: any }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { infinityPayPaymentId, evento } = request.body as any;

        if (!infinityPayPaymentId) {
          return reply.status(400).send({
            sucesso: false,
            mensagem: 'infinityPayPaymentId é obrigatório',
          });
        }

        console.log(`💳 Confirmando pagamento ${infinityPayPaymentId} para recarga ${id}`);

        const recarga = await RecargaService.confirmarPagamento(id, infinityPayPaymentId);

        await notificarClientePagamentoConfirmado(recarga);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Pagamento confirmado com sucesso',
          dados: recarga,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao confirmar pagamento',
          detalhe: error.message,
        });
      }
    }
  );
}

async function procesarPagamentoAprovado(evento: any) {
  try {
    console.log('✅ Pagamento APROVADO');

    const recargaId = evento.reference || evento.custom_id;
    const paymentId = evento.id || evento.payment_id;

    if (!recargaId) {
      console.warn('⚠️ Recarga ID não encontrado no evento');
      return;
    }

    console.log(`📝 Buscando recarga: ${recargaId}`);

    const recarga = await prisma.recarga.findUnique({
      where: { id: recargaId },
      include: {
        dealer: {
          select: { id: true, name: true, whatsapp: true, email: true },
        },
      },
    });

    if (!recarga) {
      console.error(`❌ Recarga não encontrada: ${recargaId}`);
      return;
    }

    if (recarga.status === 'CONCLUIDA') {
      console.log(`⚠️ Recarga já foi processada`);
      return;
    }

    console.log(`💰 Processando recarga de R$ ${recarga.valor.toFixed(2)}`);

    await RecargaService.confirmarPagamento(recargaId, paymentId);

    await notificarClientePagamentoConfirmado(recarga);

    console.log('✅ Recarga processada com sucesso');
  } catch (error: any) {
    console.error('❌ Erro ao processar pagamento aprovado:', error.message);
  }
}

async function procesarPagamentoRecusado(evento: any) {
  try {
    console.log('❌ Pagamento RECUSADO/FALHADO');

    const recargaId = evento.reference || evento.custom_id;
    const motivo = evento.decline_reason || evento.error_message || 'Motivo desconhecido';

    if (!recargaId) {
      console.warn('⚠️ Recarga ID não encontrado no evento');
      return;
    }

    const recarga = await prisma.recarga.findUnique({
      where: { id: recargaId },
      include: {
        dealer: {
          select: { id: true, name: true, whatsapp: true, email: true },
        },
      },
    });

    if (!recarga) {
      console.error(`❌ Recarga não encontrada: ${recargaId}`);
      return;
    }

    console.log(`📱 Notificando cliente sobre pagamento recusado...`);

    if (recarga.dealer.whatsapp) {
      await sendWhatsAppNotification(
        recarga.dealer.whatsapp,
        'Pagamento Não Aprovado ❌',
        `Seu pagamento de R$ ${recarga.valorTotal.toFixed(2)} foi recusado.\n\nMotivo: ${motivo}`,
        'Tente novamente com outro cartão ou escolha PIX como forma de pagamento.'
      );
    }

    console.log('✅ Notificação de recusa enviada ao cliente');
  } catch (error: any) {
    console.error('❌ Erro ao processar pagamento recusado:', error.message);
  }
}

async function notificarClientePagamentoConfirmado(recarga: any) {
  try {
    const dealer = recarga.dealer;

    if (!dealer.whatsapp) {
      console.warn(`⚠️ Dealer ${dealer.id} sem WhatsApp configurado`);
      return;
    }

    const creditoTotal = (recarga.valor + recarga.bonus).toFixed(2);
    const mensagemBonus =
      recarga.bonus > 0
        ? `\n🎁 Bônus: R$ ${recarga.bonus.toFixed(2)}`
        : '';

    const mensagem = `Seu pagamento de R$ ${recarga.valorTotal.toFixed(2)} foi confirmado!${mensagemBonus}\n\n💳 Crédito disponível: R$ ${creditoTotal}`;

    console.log(`📬 Enviando notificação de pagamento para ${dealer.name}...`);

    await sendWhatsAppNotification(
      dealer.whatsapp,
      'Pagamento Confirmado ✅',
      mensagem,
      'Seu crédito está pronto para usar!'
    );

    console.log('✅ Notificação de pagamento enviada');
  } catch (error: any) {
    console.error('⚠️ Erro ao notificar cliente:', error.message);
  }
}
