import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { ConsultaCompletaService } from '../services/consultaCompletaService';
import { prisma } from '../lib/prisma';

describe('ConsultaCompletaService', () => {
  const dealerMock = {
    id: 'dealer-123',
    name: 'João Silva',
    whatsapp: '11987654321',
    email: 'joao@email.com',
    document: '12345678901234',
    documentType: 'CNPJ',
    companyName: 'João Silva LTDA',
    addressZip: '12345678',
    addressStreet: 'Rua Test',
    addressNumber: '123',
    addressComplement: null,
    addressCity: 'São Paulo',
    addressState: 'SP',
    balance: 100.0,
    status: 'ATIVO',
    role: 'DEALER',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const consultaMock = {
    id: 'consulta-123',
    dealerId: 'dealer-123',
    placa: 'BRA2E19',
    status: 'EM_ANALISE',
    custo: 47.90,
    linkAnycar: null,
    pdfUrl: null,
    notaFiscal: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    vi.spyOn(prisma.dealer, 'findUnique').mockResolvedValue(dealerMock);
    vi.spyOn(prisma.dealer, 'update').mockResolvedValue(dealerMock);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  describe('solicitarConsultaCompleta', () => {
    it('deve criar consulta completa com crédito suficiente', async () => {
      const consultaEsperada = { ...consultaMock };

      vi.spyOn(prisma.consultaCompleta, 'create').mockResolvedValueOnce(consultaEsperada);
      vi.spyOn(prisma.transacao, 'create').mockResolvedValueOnce({} as any);

      const resultado = await ConsultaCompletaService.solicitarConsultaCompleta({
        dealerId: dealerMock.id,
        placa: 'BRA2E19',
      });

      expect(resultado).toBeDefined();
      expect(resultado.status).toBe('EM_ANALISE');
      expect(resultado.custo).toBe(47.90);
    });

    it('deve rejeitar consulta com crédito insuficiente', async () => {
      const dealerSemCredito = { ...dealerMock, balance: 20.0 };

      vi.spyOn(prisma.dealer, 'findUnique').mockResolvedValueOnce(dealerSemCredito);

      expect(async () => {
        await ConsultaCompletaService.solicitarConsultaCompleta({
          dealerId: dealerMock.id,
          placa: 'BRA2E19',
        });
      }).rejects.toThrow('Crédito insuficiente');
    });
  });

  describe('listarPendentes', () => {
    it('deve listar todas as consultas em análise', async () => {
      const consultasEsperadas = [
        { ...consultaMock },
        {
          ...consultaMock,
          id: 'consulta-456',
          placa: 'XYZ1234',
        },
      ];

      vi.spyOn(prisma.consultaCompleta, 'findMany').mockResolvedValueOnce(
        consultasEsperadas as any
      );

      const resultado = await ConsultaCompletaService.listarPendentes();

      expect(resultado).toHaveLength(2);
      expect(resultado[0].status).toBe('EM_ANALISE');
    });
  });

  describe('entregarConsultaCompleta', () => {
    it('deve entregar consulta com link Anycar', async () => {
      const consultaAtualizada = {
        ...consultaMock,
        status: 'CONCLUIDA',
        linkAnycar: 'https://anycar.com/pdf/123',
        pdfUrl: 'https://mobvalor.com/pdfs/123.pdf',
      };

      vi.spyOn(prisma.consultaCompleta, 'findUnique')
        .mockResolvedValueOnce(consultaMock as any)
        .mockResolvedValueOnce(consultaAtualizada as any);

      vi.spyOn(prisma.consultaCompleta, 'update').mockResolvedValueOnce(
        consultaAtualizada as any
      );

      const resultado = await ConsultaCompletaService.entregarConsultaCompleta({
        id: 'consulta-123',
        linkAnycar: 'https://anycar.com/pdf/123',
      });

      expect(resultado.status).toBe('CONCLUIDA');
      expect(resultado.pdfUrl).toBeDefined();
    });

    it('deve rejeitar entrega de consulta não em análise', async () => {
      const consultaJaConcluida = { ...consultaMock, status: 'CONCLUIDA' };

      vi.spyOn(prisma.consultaCompleta, 'findUnique').mockResolvedValueOnce(
        consultaJaConcluida as any
      );

      expect(async () => {
        await ConsultaCompletaService.entregarConsultaCompleta({
          id: 'consulta-123',
          linkAnycar: 'https://anycar.com/pdf/123',
        });
      }).rejects.toThrow('não está em análise');
    });
  });

  describe('marcarEntregue', () => {
    it('deve marcar consulta como entregue', async () => {
      const consultaConcluida = { ...consultaMock, status: 'CONCLUIDA' };
      const consultaEntregue = { ...consultaConcluida, status: 'ENTREGUE' };

      vi.spyOn(prisma.consultaCompleta, 'findUnique').mockResolvedValueOnce(
        consultaConcluida as any
      );

      vi.spyOn(prisma.consultaCompleta, 'update').mockResolvedValueOnce(consultaEntregue as any);

      const resultado = await ConsultaCompletaService.marcarEntregue('consulta-123');

      expect(resultado.status).toBe('ENTREGUE');
    });
  });
});
