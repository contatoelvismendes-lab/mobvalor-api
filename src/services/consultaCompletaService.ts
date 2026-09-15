import { prisma } from '../lib/prisma';
import { CriarConsultaCompleta, EntregarConsultaCompleta } from '../schemas/zod';
import { sendWhatsAppPdf, sendWhatsAppNotification } from './whatsappService';
import { PdfService } from './pdfService';

const CUSTO_CONSULTA_COMPLETA = 47.90;

export class ConsultaCompletaService {
  static async solicitarConsultaCompleta(dados: CriarConsultaCompleta) {
    const dealer = await prisma.dealer.findUnique({
      where: { id: dados.dealerId },
    });

    if (!dealer) {
      throw new Error('Dealer não encontrado');
    }

    if (dealer.balance < CUSTO_CONSULTA_COMPLETA) {
      throw new Error(
        `Crédito insuficiente. Necessário R$ ${CUSTO_CONSULTA_COMPLETA.toFixed(2)}, disponível R$ ${dealer.balance.toFixed(2)}`
      );
    }

    const consulta = await prisma.consultaCompleta.create({
      data: {
        dealerId: dados.dealerId,
        placa: dados.placa.toUpperCase(),
        status: 'EM_ANALISE',
        custo: CUSTO_CONSULTA_COMPLETA,
      },
    });

    await prisma.dealer.update({
      where: { id: dados.dealerId },
      data: { balance: dealer.balance - CUSTO_CONSULTA_COMPLETA },
    });

    await prisma.transacao.create({
      data: {
        dealerId: dados.dealerId,
        tipo: 'DEBITO',
        valor: CUSTO_CONSULTA_COMPLETA,
        status: 'CONCLUIDA',
        descricao: `Consulta Completa - Placa ${consulta.placa}`,
      },
    });

    return consulta;
  }

  static async listarPendentes() {
    return prisma.consultaCompleta.findMany({
      where: { status: 'EM_ANALISE' },
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
      orderBy: { createdAt: 'asc' },
    });
  }

  static async obterConsultaCompleta(id: string) {
    const consulta = await prisma.consultaCompleta.findUnique({
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

    if (!consulta) {
      throw new Error('Consulta não encontrada');
    }

    return consulta;
  }

  static async entregarConsultaCompleta(dados: EntregarConsultaCompleta) {
    const consulta = await this.obterConsultaCompleta(dados.id);

    if (consulta.status !== 'EM_ANALISE') {
      throw new Error('Esta consulta não está em análise');
    }

    let pdfUrl = dados.pdfUrl;

    if (!pdfUrl && dados.linkAnycar) {
      console.log('🔄 Formatando PDF Anycar...');
      try {
        pdfUrl = await PdfService.formatarRelatorioPdfAnycar(
          dados.linkAnycar,
          consulta.placa,
          consulta.dealerId
        );
      } catch (error: any) {
        console.error('⚠️ Erro ao formatar PDF, continuando com link Anycar:', error.message);
        pdfUrl = dados.linkAnycar;
      }
    }

    const consultaAtualizada = await prisma.consultaCompleta.update({
      where: { id: dados.id },
      data: {
        linkAnycar: dados.linkAnycar,
        pdfUrl: pdfUrl || null,
        status: 'CONCLUIDA',
      },
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

    await this.enviarResultadoAoCliente(consultaAtualizada);

    return consultaAtualizada;
  }

  private static async enviarResultadoAoCliente(consulta: any) {
    try {
      const dealer = consulta.dealer;
      const placa = consulta.placa;
      const pdfUrl = consulta.pdfUrl;

      if (!dealer.whatsapp) {
        console.warn(`⚠️ Dealer ${dealer.id} sem WhatsApp configurado`);
        return;
      }

      const nomeArquivo = `Consulta_${placa}_Mobvalor.pdf`;
      const mensagemPdf = `Sua consulta completa para a placa ${placa}`;

      console.log(`📤 Enviando PDF para ${dealer.name} (${dealer.whatsapp})...`);
      await sendWhatsAppPdf(dealer.whatsapp, pdfUrl, nomeArquivo, mensagemPdf);

      await sendWhatsAppNotification(
        dealer.whatsapp,
        'Consulta Pronta ✅',
        `Sua consulta completa para a placa *${placa}* foi processada com sucesso!`,
        'Acesse o link do PDF enviado acima para visualizar todos os detalhes.'
      );

      console.log(`✅ Resultado enviado ao cliente`);
    } catch (error: any) {
      console.error('❌ Erro ao enviar resultado:', error.message);
      throw new Error(`Consulta processada, mas falha ao notificar cliente: ${error.message}`);
    }
  }

  static async marcarEntregue(id: string) {
    const consulta = await this.obterConsultaCompleta(id);

    if (consulta.status !== 'CONCLUIDA') {
      throw new Error('Consulta deve estar concluída para marcar como entregue');
    }

    return prisma.consultaCompleta.update({
      where: { id },
      data: { status: 'ENTREGUE' },
    });
  }
}
