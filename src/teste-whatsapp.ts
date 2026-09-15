import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const WHATSAPP_TOKEN = process.env.META_ACCESS_TOKEN || '';
const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID || '';

const BASE_URL = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

async function testarMensagemTexto(telefone: string) {
  console.log('📱 Testando envio de mensagem de texto...');
  console.log(`📞 Para: ${telefone}`);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefone,
    type: 'text',
    text: {
      body: '*🎉 Teste Mobvalor*\n\nSua consulta está pronta!\n\n✅ Sistema funcionando corretamente.',
    },
  };

  try {
    const response = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Mensagem enviada com sucesso!');
    console.log('📧 Message ID:', response.data.messages[0].id);
    return true;
  } catch (error: any) {
    console.error('❌ Erro ao enviar mensagem:');
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testarPdf(telefone: string, pdfUrl: string) {
  console.log('📎 Testando envio de PDF...');
  console.log(`📞 Para: ${telefone}`);
  console.log(`🔗 PDF: ${pdfUrl}`);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefone,
    type: 'document',
    document: {
      link: pdfUrl,
      filename: 'Consulta_BRA2E19_Mobvalor.pdf',
      caption: 'Sua consulta completa está pronta! 📄',
    },
  };

  try {
    const response = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ PDF enviado com sucesso!');
    console.log('📧 Message ID:', response.data.messages[0].id);
    return true;
  } catch (error: any) {
    console.error('❌ Erro ao enviar PDF:');
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function testarNotificacao(telefone: string) {
  console.log('🔔 Testando envio de notificação...');
  console.log(`📞 Para: ${telefone}`);

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: telefone,
    type: 'text',
    text: {
      body: '*Pagamento Confirmado ✅*\n\nSeu pagamento de R$ 599,90 foi confirmado!\n\n🎁 Bônus: R$ 29,99\n💳 Crédito total: R$ 629,89\n\nSeu crédito está pronto para usar!',
    },
  };

  try {
    const response = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Notificação enviada com sucesso!');
    console.log('📧 Message ID:', response.data.messages[0].id);
    return true;
  } catch (error: any) {
    console.error('❌ Erro ao enviar notificação:');
    console.error(error.response?.data || error.message);
    return false;
  }
}

async function main() {
  const telefone = process.argv[2];

  if (!telefone) {
    console.error(
      '❌ Forneça um número de telefone como argumento:\ntsx src/teste-whatsapp.ts 551187654321'
    );
    process.exit(1);
  }

  console.log('🚀 Iniciando testes WhatsApp Mobvalor\n');
  console.log(`🔑 Token: ${WHATSAPP_TOKEN?.slice(0, 10)}...`);
  console.log(`📱 Phone ID: ${PHONE_NUMBER_ID}\n`);

  // Teste 1: Mensagem de texto
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await testarMensagemTexto(telefone);

  console.log('\n');

  // Teste 2: Notificação
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  await testarNotificacao(telefone);

  console.log('\n');

  // Teste 3: PDF (opcional - precisa de URL real)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const pdfUrl = process.argv[3];
  if (pdfUrl) {
    await testarPdf(telefone, pdfUrl);
  } else {
    console.log('💡 Para testar PDF, passe a URL como segundo argumento:');
    console.log('   tsx src/teste-whatsapp.ts 551187654321 https://seu-pdf.com/arquivo.pdf');
  }

  console.log('\n✅ Testes concluídos!');
}

main().catch(console.error);
