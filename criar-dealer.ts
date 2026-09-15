import { prisma } from './src/lib/prisma';

async function criarDealer() {
  try {
    const dealer = await prisma.dealer.create({
      data: {
        id: 'dd900c9e-cb7e-429f-855c-9a38febc7217',
        name: 'Elvis Test',
        whatsapp: '5581992086375',
        email: 'test@mobvalor.com',
        balance: 100,
      },
    });

    console.log('✅ Dealer criado com sucesso!');
    console.log(JSON.stringify(dealer, null, 2));
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Erro ao criar dealer:');
    console.error(error.message);
    process.exit(1);
  }
}

criarDealer();
