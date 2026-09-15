import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export enum DealerState {
  MENU = 'MENU',
  WAITING_PLATE = 'WAITING_PLATE',
  PLATE_RECEIVED = 'PLATE_RECEIVED',
  WAITING_CONFIRMATION = 'WAITING_CONFIRMATION',
  WAITING_REGISTRATION = 'WAITING_REGISTRATION',
  WAITING_PAYMENT = 'WAITING_PAYMENT'
}

export class DealerStateManager {
  static async setState(whatsapp: string, state: DealerState, contextData?: any) {
    console.log(`🔄 Estado alterado: ${state} | Dealer: ${whatsapp}`);

    return await prisma.dealer.update({
      where: { whatsapp },
      data: {
        state,
        context_data: contextData || {}
      }
    });
  }

  static async getState(whatsapp: string) {
    const dealer = await prisma.dealer.findUnique({ where: { whatsapp } });
    return {
      state: (dealer?.state as DealerState) || DealerState.MENU,
      plate: dealer?.current_plate,
      context: dealer?.context_data,
      dealer
    };
  }

  static async savePlate(whatsapp: string, plate: string) {
    console.log(`🚗 Placa salva: ${plate} | Dealer: ${whatsapp}`);

    return await prisma.dealer.update({
      where: { whatsapp },
      data: {
        current_plate: plate,
        state: DealerState.PLATE_RECEIVED
      }
    });
  }

  static async resetToMenu(whatsapp: string) {
    console.log(`🔄 Voltando ao MENU | Dealer: ${whatsapp}`);

    return await prisma.dealer.update({
      where: { whatsapp },
      data: {
        state: DealerState.MENU,
        current_plate: null,
        context_data: {}
      }
    });
  }
}
