import axios from 'axios';

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';

const BASE_URL = `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`;

export interface WhatsAppButton {
  id: string;
  title: string; // Limite da Meta: máximo de 20 caracteres
}

export async function sendWhatsAppMessage(to: string, text: string) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('Credenciais do WhatsApp ausentes no .env');
    return;
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: text },
  };

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  } catch (error: any) {
    console.error('Erro ao enviar mensagem WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

export async function sendWhatsAppButtons(to: string, text: string, buttons: WhatsAppButton[]) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('Credenciais do WhatsApp ausentes no .env');
    return;
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: {
            id: btn.id,
            title: btn.title.slice(0, 20), // Garante o teto de 20 caracteres exigido pela Meta
          },
        })),
      },
    },
  };

  try {
    const res = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    return res.data;
  } catch (error: any) {
    console.error('Erro ao enviar botões interativos WhatsApp:', error.response?.data || error.message);
    throw error;
  }
}

export async function sendWhatsAppPdf(
  to: string,
  pdfUrl: string,
  nomeArquivo: string,
  mensagem?: string
) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('Credenciais do WhatsApp ausentes no .env');
    throw new Error('Credenciais WhatsApp não configuradas');
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'document',
    document: {
      link: pdfUrl,
      filename: nomeArquivo,
      caption: mensagem || 'Seu relatório está pronto',
    },
  };

  try {
    console.log(`📤 Enviando PDF para ${to}...`);
    console.log(`📎 Arquivo: ${nomeArquivo}`);
    console.log(`🔗 URL: ${pdfUrl}`);

    const res = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ PDF enviado com sucesso`);
    return res.data;
  } catch (error: any) {
    console.error('Erro ao enviar PDF via WhatsApp:', error.response?.data || error.message);
    throw new Error(`Falha ao enviar PDF: ${error.message}`);
  }
}

export async function sendWhatsAppNotification(
  to: string,
  titulo: string,
  mensagem: string,
  acao?: string
) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    console.error('Credenciais do WhatsApp ausentes no .env');
    throw new Error('Credenciais WhatsApp não configuradas');
  }

  const textoCompleto = `*${titulo}*\n\n${mensagem}${acao ? `\n\n${acao}` : ''}`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { body: textoCompleto },
  };

  try {
    console.log(`📬 Enviando notificação para ${to}...`);

    const res = await axios.post(BASE_URL, payload, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`✅ Notificação enviada com sucesso`);
    return res.data;
  } catch (error: any) {
    console.error('Erro ao enviar notificação:', error.response?.data || error.message);
    throw new Error(`Falha ao enviar notificação: ${error.message}`);
  }
}