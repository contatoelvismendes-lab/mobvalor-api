import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { InfosimplesService, ConsultaVeiculoParams } from '../services/infosimplesService';

export async function renaveRoutes(fastify: FastifyInstance) {
  const infosimples = new InfosimplesService();

  // Rota de consulta real via Infosimples
  fastify.post('/api/renave-on/consultar', async (req: FastifyRequest<{ Body: ConsultaVeiculoParams }>, reply: FastifyReply) => {
    const { placa, renavam, uf = 'SP' } = req.body || {};

    if (!placa || !renavam) {
      return reply.status(400).send({
        sucesso: false,
        mensagem: 'Parâmetros "placa" e "renavam" são obrigatórios.',
      });
    }

    try {
      const laudo = await infosimples.gerarLaudoRenaveOn({ placa, renavam, uf });
      return reply.status(200).send({
        sucesso: true,
        placa,
        renavam,
        uf,
        laudo,
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.status(500).send({
        sucesso: false,
        mensagem: 'Erro ao processar consulta de laudo Renave On.',
        detalhe: error.message,
      });
    }
  });

  // Rota de teste mockado (sem gastar saldo da API)
  fastify.post('/api/renave-on/test-mock', async (req: FastifyRequest<{ Body: { cenario?: string; placa?: string; renavam?: string } }>, reply: FastifyReply) => {
    const { cenario = 'apto', placa = 'BRA2E19', renavam = '10293847561' } = req.body || {};

    const laudoMock = cenario === 'restrito'
      ? {
          aptoParaEntrada: false,
          totalPendencias: 2,
          pendenciasIdentificadas: [
            'Alienação Fiduciária / Gravame Ativo (Banco Santander)',
            'Bloqueio Judicial Ativo (RENAJUD)',
          ],
        }
      : {
          aptoParaEntrada: true,
          totalPendencias: 0,
          pendenciasIdentificadas: [],
        };

    return reply.status(200).send({
      sucesso: true,
      tipo: 'MOCK',
      placa,
      renavam,
      laudo: laudoMock,
    });
  });
}