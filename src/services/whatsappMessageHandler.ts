import { prisma } from '../lib/prisma';
import { sendWhatsAppNotification } from './whatsappService';
import { ConsultaCompletaService } from './consultaCompletaService';
import { RecargaService } from './recargaService';

export class WhatsAppMessageHandler {
  static async procesarMensagem(phoneNumber: string, mensagem: string) {
    console.log(`📱 Mensagem de ${phoneNumber}: ${mensagem}`);

    try {
      // 1. Encontrar ou criar dealer
      let dealer = await prisma.dealer.findUnique({
        where: { whatsapp: phoneNumber }
      });

      if (!dealer) {
        console.log(`👤 Dealer não encontrado, criando novo...`);
        dealer = await prisma.dealer.create({
          data: {
            whatsapp: phoneNumber,
            name: `Lojista ${phoneNumber}`,
            email: `${phoneNumber}@mobvalor.com`,
            balance: 0
          }
        });

        await sendWhatsAppNotification(
          phoneNumber,
          'Bem-vindo à Mobvalor!',
          'Sua conta foi criada com sucesso! 🎉\n\nVocê pode solicitar:\n✅ *Consulta* - Análise completa de veículo\n✅ *Recarga* - Adicione crédito\n\nComo posso ajudar?'
        );
        return;
      }

      // 2. Processar comando
      const comando = mensagem.toLowerCase().trim();

      if (comando.includes('consulta')) {
        await this.solicitarConsulta(dealer);
      } else if (comando.includes('recarga')) {
        await this.solicitarRecarga(dealer);
      } else if (comando.includes('saldo') || comando.includes('crédito')) {
        await this.consultarSaldo(dealer);
      } else if (comando.includes('ajuda') || comando.includes('menu')) {
        await this.mostrarMenu(dealer);
      } else {
        await sendWhatsAppNotification(
          phoneNumber,
          'Opção não entendida',
          'Desculpe, não entendi. Tente:\n\n✅ *Consulta* - Solicitar análise\n✅ *Recarga* - Adicionar crédito\n✅ *Saldo* - Ver seu crédito\n✅ *Ajuda* - Ver opções'
        );
      }
    } catch (error: any) {
      console.error('❌ Erro ao processar mensagem:', error.message);
      await sendWhatsAppNotification(
        phoneNumber,
        'Erro ao processar',
        'Ocorreu um erro. Tente novamente mais tarde.'
      );
    }
  }

  private static async solicitarConsulta(dealer: any) {
    console.log(`🔍 Solicitando consulta para ${dealer.whatsapp}`);

    if (dealer.balance < 47.90) {
      await sendWhatsAppNotification(
        dealer.whatsapp,
        'Crédito insuficiente',
        `Você tem R$ ${dealer.balance.toFixed(2)}\n\nUma consulta custa R$ 47.90\n\nUse *Recarga* para adicionar crédito!`
      );
      return;
    }

    // Criar consulta
    const consulta = await ConsultaCompletaService.solicitarConsultaCompleta({
      dealerId: dealer.id,
      placa: 'XXXX',
      custo: 47.90
    });

    await sendWhatsAppNotification(
      dealer.whatsapp,
      'Consulta Solicitada ✅',
      `Sua consulta foi criada!\n\n📋 ID: ${consulta.id}\n💰 Custo: R$ 47.90\n⏱️ Tempo: até 5 minutos\n\nUm atendente irá processar em breve!`
    );
  }

  private static async solicitarRecarga(dealer: any) {
    console.log(`💳 Solicitando recarga para ${dealer.whatsapp}`);

    await sendWhatsAppNotification(
      dealer.whatsapp,
      'Recarga Disponível 💰',
      'Qual valor deseja recarregar?\n\n💳 *Cartão* - 2.99% de taxa\n🏦 *PIX* - Sem taxa\n\n🎁 Bônus: 5% acima de R$ 499\n\nResponda com o valor (ex: 500)'
    );
  }

  private static async consultarSaldo(dealer: any) {
    console.log(`💰 Consultando saldo de ${dealer.whatsapp}`);

    await sendWhatsAppNotification(
      dealer.whatsapp,
      'Seu Saldo',
      `💳 Crédito disponível: *R$ ${dealer.balance.toFixed(2)}*\n\n✅ Uma consulta custa R$ 47.90\n✅ Use *Recarga* para adicionar crédito`
    );
  }

  private static async mostrarMenu(dealer: any) {
    console.log(`📋 Mostrando menu para ${dealer.whatsapp}`);

    await sendWhatsAppNotification(
      dealer.whatsapp,
      'Menu Mobvalor',
      `Olá ${dealer.name}! 👋\n\nO que você quer fazer?\n\n🔍 *Consulta* - Análise completa de veículo (R$ 47.90)\n💰 *Recarga* - Adicionar crédito à conta\n💳 *Saldo* - Ver seu crédito\n❓ *Ajuda* - Ver este menu\n\nTipo a opção e mando fazer!`
    );
  }
}
