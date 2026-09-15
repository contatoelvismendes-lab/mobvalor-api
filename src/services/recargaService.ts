import { prisma } from '../lib/prisma';
import { CriarRecarga } from '../schemas/zod';

const TAXA_PIX = 0;
const TAXA_CARTAO = 0.0299;
const BONUS_MINIMO = 499;
const PERCENTUAL_BONUS = 0.05;

export class RecargaService {
  static calcularTaxa(valor: number, formaPagamento: string) {
    if (formaPagamento === 'PIX') {
      return TAXA_PIX;
    } else if (formaPagamento === 'CARTAO') {
      return valor * TAXA_CARTAO;
    }
    return 0;
  }

  static calcularBonus(valor: number) {
    if (valor >= BONUS_MINIMO) {
      return valor * PERCENTUAL_BONUS;
    }
    return 0;
  }

  static async criar(dados: CriarRecarga) {
    const dealer = await prisma.dealer.findUnique({
      where: { id: dados.dealerId },
    });

    if (!dealer) {
      throw new Error('Dealer não encontrado');
    }

    const taxa = this.calcularTaxa(dados.valor, dados.formaPagamento);
    const valorTotal = dados.valor + taxa;
    const bonus = this.calcularBonus(dados.valor);

    const recarga = await prisma.recarga.create({
      data: {
        dealerId: dados.dealerId,
        valor: dados.valor,
        taxa,
        valorTotal,
        formaPagamento: dados.formaPagamento,
        bonus,
        status: 'PENDENTE',
      },
    });

    return recarga;
  }

  static async obterRecarga(id: string) {
    const recarga = await prisma.recarga.findUnique({
      where: { id },
      include: {
        dealer: {
          select: {
            id: true,
            name: true,
            whatsapp: true,
            email: true,
          },
        },
      },
    });

    if (!recarga) {
      throw new Error('Recarga não encontrada');
    }

    return recarga;
  }

  static async confirmarPagamento(recargaId: string, infinityPayPaymentId: string) {
    const recarga = await this.obterRecarga(recargaId);

    if (recarga.status !== 'PENDENTE') {
      throw new Error('Esta recarga não está pendente');
    }

    const recargaAtualizada = await prisma.recarga.update({
      where: { id: recargaId },
      data: {
        status: 'CONCLUIDA',
        infinityPayPaymentId,
      },
    });

    const credito = recarga.valor + recarga.bonus;

    await prisma.dealer.update({
      where: { id: recarga.dealerId },
      data: { balance: { increment: credito } },
    });

    await prisma.transacao.create({
      data: {
        dealerId: recarga.dealerId,
        tipo: 'CREDITO',
        valor: credito,
        status: 'CONCLUIDA',
        descricao: `Recarga de R$ ${recarga.valor.toFixed(2)} ${recarga.bonus > 0 ? `+ R$ ${recarga.bonus.toFixed(2)} bônus` : ''}`,
      },
    });

    return recargaAtualizada;
  }

  static async cancelarRecarga(recargaId: string) {
    const recarga = await this.obterRecarga(recargaId);

    if (recarga.status !== 'PENDENTE') {
      throw new Error('Apenas recarga pendentes podem ser canceladas');
    }

    return prisma.recarga.update({
      where: { id: recargaId },
      data: { status: 'CANCELADA' },
    });
  }

  static async listarRecargasDealer(dealerId: string) {
    return prisma.recarga.findMany({
      where: { dealerId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
