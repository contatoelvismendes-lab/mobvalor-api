import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { RecargaService } from '../services/recargaService';
import { criarRecargaSchema } from '../schemas/zod';

export async function recargaRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: any }>(
    '/recargas',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      try {
        const validado = criarRecargaSchema.parse(request.body);
        const recarga = await RecargaService.criar(validado);

        const resumoTaxa =
          recarga.taxa > 0 ? ` (valor + R$ ${recarga.taxa.toFixed(2)} de taxa)` : '';
        const resumoBonus = recarga.bonus > 0 ? ` - Bônus de R$ ${recarga.bonus.toFixed(2)}` : '';

        return reply.status(201).send({
          sucesso: true,
          mensagem: `Recarga de R$ ${recarga.valor.toFixed(2)}${resumoTaxa}${resumoBonus}`,
          dados: recarga,
          proxiPasso: {
            acao: 'Redirecionar para pagamento InfinitePay',
            recargaId: recarga.id,
            valor: recarga.valorTotal,
            formaPagamento: recarga.formaPagamento,
          },
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            sucesso: false,
            mensagem: 'Validação falhou',
            erros: error.errors,
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao criar recarga',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/recargas/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const recarga = await RecargaService.obterRecarga(id);

        return reply.status(200).send({
          sucesso: true,
          dados: recarga,
        });
      } catch (error: any) {
        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            sucesso: false,
            mensagem: 'Recarga não encontrada',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao obter recarga',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.get<{ Params: { dealerId: string } }>(
    '/dealers/:dealerId/recargas',
    async (request: FastifyRequest<{ Params: { dealerId: string } }>, reply: FastifyReply) => {
      try {
        const { dealerId } = request.params;
        const recargas = await RecargaService.listarRecargasDealer(dealerId);

        return reply.status(200).send({
          sucesso: true,
          dados: recargas,
          total: recargas.length,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao listar recargas',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.post<{ Params: { id: string }; Body: { infinityPayPaymentId: string } }>(
    '/recargas/:id/confirmar',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { infinityPayPaymentId: string } }>,
      reply: FastifyReply
    ) => {
      try {
        const { id } = request.params;
        const { infinityPayPaymentId } = request.body;

        if (!infinityPayPaymentId) {
          return reply.status(400).send({
            sucesso: false,
            mensagem: 'infinityPayPaymentId é obrigatório',
          });
        }

        const recarga = await RecargaService.confirmarPagamento(id, infinityPayPaymentId);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Pagamento confirmado e crédito adicionado com sucesso',
          dados: recarga,
        });
      } catch (error: any) {
        if (error.message.includes('não está pendente')) {
          return reply.status(409).send({
            sucesso: false,
            mensagem: error.message,
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao confirmar pagamento',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.post<{ Params: { id: string } }>(
    '/recargas/:id/cancelar',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const recarga = await RecargaService.cancelarRecarga(id);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Recarga cancelada',
          dados: recarga,
        });
      } catch (error: any) {
        if (error.message.includes('não podem ser canceladas')) {
          return reply.status(409).send({
            sucesso: false,
            mensagem: error.message,
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao cancelar recarga',
          detalhe: error.message,
        });
      }
    }
  );
}
