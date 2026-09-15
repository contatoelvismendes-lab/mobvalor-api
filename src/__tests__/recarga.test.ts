import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { RecargaService } from '../services/recargaService';
import { prisma } from '../lib/prisma';

describe('RecargaService', () => {
  const dealerMock = {
    id: 'dealer-123',
    name: 'João Silva',
    whatsapp: '11987654321',
    email: 'joao@email.com',
    balance: 100.0,
  };

  const recargaMock = {
    id: 'recarga-123',
    dealerId: 'dealer-123',
    valor: 599.90,
    taxa: 17.97,
    valorTotal: 617.87,
    formaPagamento: 'CARTAO',
    status: 'PENDENTE',
    bonus: 29.99,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    vi.spyOn(prisma.dealer, 'findUnique').mockResolvedValue(dealerMock);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  describe('calcularTaxa', () => {
    it('deve calcular taxa PIX como 0%', () => {
      const taxa = RecargaService.calcularTaxa(500, 'PIX');
      expect(taxa).toBe(0);
    });

    it('deve calcular taxa Cartão como 2.99%', () => {
      const taxa = RecargaService.calcularTaxa(600, 'CARTAO');
      expect(taxa).toBeCloseTo(17.94, 2);
    });
  });

  describe('calcularBonus', () => {
    it('deve calcular 5% de bônus para valor >= R$ 499', () => {
      const bonus = RecargaService.calcularBonus(500);
      expect(bonus).toBe(25);
    });

    it('deve retornar 0 de bônus para valor < R$ 499', () => {
      const bonus = RecargaService.calcularBonus(400);
      expect(bonus).toBe(0);
    });

    it('deve calcular 5% de bônus exatamente em R$ 499', () => {
      const bonus = RecargaService.calcularBonus(499);
      expect(bonus).toBeCloseTo(24.95, 2);
    });
  });

  describe('criar', () => {
    it('deve criar recarga com taxa e bônus calculados', async () => {
      vi.spyOn(prisma.recarga, 'create').mockResolvedValueOnce(recargaMock as any);

      const resultado = await RecargaService.criar({
        dealerId: dealerMock.id,
        valor: 599.90,
        formaPagamento: 'CARTAO',
      });

      expect(resultado).toBeDefined();
      expect(resultado.status).toBe('PENDENTE');
      expect(resultado.taxa).toBeCloseTo(17.97, 2);
      expect(resultado.bonus).toBeCloseTo(29.99, 2);
    });
  });

  describe('confirmarPagamento', () => {
    it('deve confirmar pagamento e adicionar crédito', async () => {
      const recargaPendente = { ...recargaMock };
      const recargaConcluida = { ...recargaMock, status: 'CONCLUIDA' };

      vi.spyOn(prisma.recarga, 'findUnique').mockResolvedValueOnce(recargaPendente as any);

      vi.spyOn(prisma.recarga, 'update').mockResolvedValueOnce(recargaConcluida as any);

      vi.spyOn(prisma.dealer, 'update').mockResolvedValueOnce({
        ...dealerMock,
        balance: dealerMock.balance + 599.90 + 29.99,
      });

      vi.spyOn(prisma.transacao, 'create').mockResolvedValueOnce({} as any);

      const resultado = await RecargaService.confirmarPagamento(
        'recarga-123',
        'infinitypay_123'
      );

      expect(resultado.status).toBe('CONCLUIDA');
    });

    it('deve rejeitar confirmação de recarga já processada', async () => {
      const recargaConcluida = { ...recargaMock, status: 'CONCLUIDA' };

      vi.spyOn(prisma.recarga, 'findUnique').mockResolvedValueOnce(recargaConcluida as any);

      expect(async () => {
        await RecargaService.confirmarPagamento('recarga-123', 'infinitypay_123');
      }).rejects.toThrow('não está pendente');
    });
  });

  describe('cancelarRecarga', () => {
    it('deve cancelar recarga pendente', async () => {
      const recargaCancelada = { ...recargaMock, status: 'CANCELADA' };

      vi.spyOn(prisma.recarga, 'findUnique').mockResolvedValueOnce(recargaMock as any);

      vi.spyOn(prisma.recarga, 'update').mockResolvedValueOnce(recargaCancelada as any);

      const resultado = await RecargaService.cancelarRecarga('recarga-123');

      expect(resultado.status).toBe('CANCELADA');
    });
  });

  describe('listarRecargasDealer', () => {
    it('deve listar recargas do dealer ordenadas por data', async () => {
      const recargas = [recargaMock, { ...recargaMock, id: 'recarga-456' }];

      vi.spyOn(prisma.recarga, 'findMany').mockResolvedValueOnce(recargas as any);

      const resultado = await RecargaService.listarRecargasDealer('dealer-123');

      expect(resultado).toHaveLength(2);
    });
  });
});
