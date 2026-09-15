import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PacoteService } from '../services/pacoteService';
import { criarPacoteSchema, atualizarPacoteSchema } from '../schemas/zod';

export async function pacotesRoutes(fastify: FastifyInstance) {
  fastify.get('/pacotes', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const ativo = request.query.ativo ? request.query.ativo === 'true' : undefined;
      const pacotes = await PacoteService.listarPacotes(ativo);

      return reply.status(200).send({
        sucesso: true,
        dados: pacotes,
        total: pacotes.length,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        sucesso: false,
        mensagem: 'Erro ao listar pacotes',
        detalhe: error.message,
      });
    }
  });

  fastify.get<{ Params: { id: string } }>(
    '/pacotes/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const pacote = await PacoteService.obterPacote(id);

        return reply.status(200).send({
          sucesso: true,
          dados: pacote,
        });
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            sucesso: false,
            mensagem: 'Pacote não encontrado',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao obter pacote',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.post<{ Body: any }>(
    '/pacotes',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      try {
        const validado = criarPacoteSchema.parse(request.body);
        const pacote = await PacoteService.criarPacote(validado);

        return reply.status(201).send({
          sucesso: true,
          mensagem: 'Pacote criado com sucesso',
          dados: pacote,
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
          mensagem: 'Erro ao criar pacote',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.patch<{ Params: { id: string }; Body: any }>(
    '/pacotes/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const validado = atualizarPacoteSchema.partial().parse(request.body);

        const pacote = await PacoteService.atualizarPacote(id, validado);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Pacote atualizado com sucesso',
          dados: pacote,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.status(400).send({
            sucesso: false,
            mensagem: 'Validação falhou',
            erros: error.errors,
          });
        }

        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            sucesso: false,
            mensagem: 'Pacote não encontrado',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao atualizar pacote',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    '/pacotes/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const pacote = await PacoteService.deletarPacote(id);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Pacote deletado com sucesso',
          dados: pacote,
        });
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            sucesso: false,
            mensagem: 'Pacote não encontrado',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao deletar pacote',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.patch<{ Params: { id: string } }>(
    '/pacotes/:id/ativar',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const pacote = await PacoteService.ativarPacote(id);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Pacote ativado com sucesso',
          dados: pacote,
        });
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            sucesso: false,
            mensagem: 'Pacote não encontrado',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao ativar pacote',
          detalhe: error.message,
        });
      }
    }
  );

  fastify.patch<{ Params: { id: string } }>(
    '/pacotes/:id/desativar',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      try {
        const { id } = request.params;
        const pacote = await PacoteService.desativarPacote(id);

        return reply.status(200).send({
          sucesso: true,
          mensagem: 'Pacote desativado com sucesso',
          dados: pacote,
        });
      } catch (error: any) {
        if (error.message.includes('não encontrado')) {
          return reply.status(404).send({
            sucesso: false,
            mensagem: 'Pacote não encontrado',
          });
        }

        fastify.log.error(error);
        return reply.status(500).send({
          sucesso: false,
          mensagem: 'Erro ao desativar pacote',
          detalhe: error.message,
        });
      }
    }
  );
}
