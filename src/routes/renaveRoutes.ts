import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
// Importe aqui o serviço do seu fornecedor atual (Anycar ou Zapcar)
// Exemplo: import { AnycarService } from '../services/anycarService';

export async function renaveRoutes(fastify: FastifyInstance) {
  // const anycar = new AnycarService();

  // Rota de consulta real focada apenas na placa
  fastify.post('/api/renave-on/consultar', async (req: FastifyRequest<{ Body: { placa: string } }>, reply: FastifyReply) => {
    const { placa } = req.body || {};

    if (!placa) {
      return reply.status(400).send({
        sucesso: false,
        mensagem: 'O parâmetro "placa" é obrigatório.',
      });
    }

    try {
      const cleanPlate = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

      // Exemplo de chamada real utilizando o fornecedor (Anycar / Zapcar) apenas com a placa:
      // const resultadoApi = await anycar.consultarRenave({ placa: cleanPlate });

      // Resposta simulada/estruturada para entrega ao webhook
      const laudoMock = {
        aptoParaEntrada: true,
        detalhes: 'Veículo apto para entrada no Renave. Sem restrições ativas.'
      };

      return reply.status(200).send({
        sucesso: true,
        placa: cleanPlate,
        laudo: laudoMock,
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

  // Rota de teste mockado (sem gastar saldo)
  fastify.post('/api/renave-on/test-mock', async (req: FastifyRequest<{ Body: { cenario?: string; placa?: string } }>, reply: FastifyReply) => {
    const { cenario = 'apto', placa = 'BRA2E19' } = req.body || {};

    const laudoMock = cenario === 'restrito'
      ? {
          aptoParaEntrada: false,
          detalhes: 'Veículo possui restrições ativas (Alienação Fiduciária / Gravame).'
        }
      : {
          aptoParaEntrada: true,
          detalhes: 'Veículo apto para entrada no Renave.'
        };

    return reply.status(200).send({
      sucesso: true,
      tipo: 'MOCK',
      placa,
      laudo: laudoMock,
    });
  });
}