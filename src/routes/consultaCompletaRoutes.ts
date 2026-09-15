import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ConsultaCompletaService } from '../services/consultaCompletaService';
import { criarConsultaCompletaSchema, entregarConsultaCompletaSchema } from '../schemas/zod';

export async function consultaCompletaRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: any }>(
    '/consultas/completa',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      try {
        const validado = criarConsultaCompletaSchema.parse(request.body);
        const consulta = await ConsultaCompletaService.solicitarConsultaCompleta(validado);

        return reply.status(201).send({
          sucesso: true,
          mensagem: 'Sua consulta está em análise, ficará pronta em até 5 minutos',
          dados: consulta,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            sucesso: false,
            mensagem: 'Validação falhou',
            erros: error.errors,
          });
        }

        if (error.message.includes('Crédito insuficiente')) {
          return reply.status(402).send({
            sucesso: false,
            mensagem: error.message,
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao solicitar consulta completa',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.get(
    '/atendente/consultas-completas/pendentes',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const consultas = await ConsultaCompletaService.listarPendentes();

        return reply.status(200).send({
          sucesso: true,
          dados: consultas,
          total: consultas.length,
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao listar consultas pendentes',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.get<{ Params: { id: string } }>(
    '/atendente/consultas-completas/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const consulta = await ConsultaCompletaService.obterConsultaCompleta(id);

        return reply.status(200).send({
          sucesso: true,
          dados: consulta,
        });
      } catch (error: any) {
        if (error.message.includes('não encontrada')) {
          return reply.status(404).send({
            sucesso: false,
            mensagem: 'Consulta não encontrada',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao obter consulta',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.patch<{ Params: { id: string }; Body: any }>(
    '/atendente/consultas-completas/:id/entregar',
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const dados = entregarConsultaCompletaSchema.parse({
          id: request.params.id,
          ...request.body,
        });

        const consulta = await ConsultaCompletaService.entregarConsultaCompleta(dados);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Consulta entregue com sucesso. PDF enviado ao cliente via WhatsApp',
          dados: consulta,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            sucesso: false,
            mensagem: 'Validação falhou',
            erros: error.errors,
          });
        }

        if (error.message.includes('não está em análise')) {
          return reply.status(409).send({
            sucesso: false,
            mensagem: error.message,
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao entregar consulta',
          detalhe: error.message,
        });
      }
    }
  );
}
