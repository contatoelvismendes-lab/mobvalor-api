import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Função auxiliar para enviar mensagens de texto simples
async function sendWhatsAppText(to: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  await axios.post(
    `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

// Função auxiliar para enviar botões interativos (Reply Buttons)
async function sendWhatsAppButtons(to: string, bodyText: string, buttons: Array<{ id: string, title: string }>) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  await axios.post(
    `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: { id: btn.id, title: btn.title }
          }))
        }
      }
    },
    { headers: { Authorization: `Bearer ${token}` } }
  );
}

// Função para buscar dados do CNPJ na API pública
async function fetchCompanyData(cnpj: string) {
  const cleanCnpj = cnpj.replace(/\D/g, '');
  try {
    const response = await axios.get(`https://publica.cnpj.ws/cnpj/${cleanCnpj}`);
    const data = response.data;
    return {
      success: true,
      cnpj: cleanCnpj,
      companyName: data.razao_social,
      zip: data.estabelecimento.cep,
      street: `${data.estabelecimento.logradouro}, ${data.estabelecimento.numero}${data.estabelecimento.complemento ? ' ' + data.estabelecimento.complemento : ''}`,
      neighborhood: data.estabelecimento.bairro,
      city: data.estabelecimento.cidade.nome,
      state: data.estabelecimento.estado.sigla
    };
  } catch (err) {
    return { success: false };
  }
}

export async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.post('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const body: any = request.body;

    try {
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) return reply.status(200).send({ status: 'ignored' });

      const from = message.from; // Número do WhatsApp
      const msgType = message.type;
      let textContent = '';

      if (msgType === 'text') {
        textContent = message.text.body.trim();
      } else if (msgType === 'interactive') {
        textContent = message.interactive.button_reply.id; // ID do botão clicado
      } else {
        return reply.status(200).send({ status: 'unsupported_type' });
      }

      // 1. Busca ou inicializa o usuário no banco
      let dealer = await prisma.dealer.findUnique({ where: { whatsapp: from } });

      if (!dealer) {
        dealer = await prisma.dealer.create({
          data: {
            whatsapp: from,
            registrationStep: 'WAITING_NAME',
            balance: 10.0 // Saldo inicial de cortesia para testes
          }
        });

        await sendWhatsAppText(from, "Vamos lá 🏁\n\nNosso cadastro é *super simples e rápido*, como tudo o que fazemos aqui no MobValor é super.");
        await sendWhatsAppText(from, "Qual é o seu nome?\n\n💡 _Como prefere ser chamado(a) para personalizar seu atendimento._");
        return reply.status(200).send({ status: 'ok' });
      }

      // 2. Máquina de Estados do Cadastro
      switch (dealer.registrationStep) {
        case 'WAITING_NAME':
          await prisma.dealer.update({
            where: { id: dealer.id },
            data: { name: textContent, registrationStep: 'CONFIRMING_NAME' }
          });
          await sendWhatsAppButtons(from, `Ok, seu nome está correto?\n\n*${textContent}*`, [
            { id: 'btn_name_yes', title: 'SIM' },
            { id: 'btn_name_no', title: 'NÃO, CORRIGIR' }
          ]);
          break;

        case 'CONFIRMING_NAME':
          if (textContent === 'btn_name_yes' || textContent.toLowerCase() === 'sim') {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'WAITING_EMAIL' }
            });
            await sendWhatsAppText(from, "Qual é o seu e-mail?\n\n💡 _Preciso do seu melhor e-mail para envio de comunicados, notas fiscais, relatórios, etc._");
          } else {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'WAITING_NAME' }
            });
            await sendWhatsAppText(from, "Qual é o seu nome?");
          }
          break;

        case 'WAITING_EMAIL':
          await prisma.dealer.update({
            where: { id: dealer.id },
            data: { email: textContent, registrationStep: 'CONFIRMING_EMAIL' }
          });
          await sendWhatsAppButtons(from, `Seu email está correto?\n\n*${textContent}*`, [
            { id: 'btn_email_yes', title: 'SIM' },
            { id: 'btn_email_no', title: 'NÃO, CORRIGIR' }
          ]);
          break;

        case 'CONFIRMING_EMAIL':
          if (textContent === 'btn_email_yes' || textContent.toLowerCase() === 'sim') {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'WAITING_DOCUMENT' }
            });
            await sendWhatsAppText(from, "Qual é o CNPJ da sua empresa?\n\n💡 _Utilize apenas os números._");
          } else {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'WAITING_EMAIL' }
            });
            await sendWhatsAppText(from, "Qual é o seu e-mail?");
          }
          break;

        case 'WAITING_DOCUMENT':
          const company = await fetchCompanyData(textContent);
          if (!company.success) {
            await sendWhatsAppText(from, "❌ CNPJ não encontrado na Receita Federal. Por favor, digite um CNPJ válido:");
            return reply.status(200).send({ status: 'ok' });
          }

          // Salva os dados validados com tratamento seguro de tipos
          await prisma.dealer.update({
            where: { id: dealer.id },
            data: {
              documentType: 'CNPJ',
              document: company.cnpj || '',
              companyName: company.companyName || null,
              addressZip: company.zip || null,
              addressStreet: company.street || null,
              addressNeighborhood: company.neighborhood || null,
              addressCity: company.city || null,
              addressState: company.state || null,
              registrationStep: 'CONFIRMING_COMPANY'
            }
          });

          const summaryText = `🔎 Confirme os dados da sua empresa:\n\n${company.cnpj}\n${company.companyName}\n\n${company.zip}\n${company.street}\n${company.neighborhood}, ${company.city} ${company.state}`;
          await sendWhatsAppButtons(from, summaryText, [
            { id: 'btn_comp_ok', title: 'CONFIRMAR' },
            { id: 'btn_comp_redo', title: 'ALTERAR CNPJ' }
          ]);
          break;

        case 'CONFIRMING_COMPANY':
          if (textContent === 'btn_comp_ok' || textContent.toLowerCase() === 'sim') {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'COMPLETED' }
            });
            await sendWhatsAppText(from, "Tudo certo com seu cadastro ✅\n\nSeja muito bem-vindo(a) ao MobValor! Agora que seu cadastro foi concluído, seu WhatsApp sempre será reconhecido automaticamente.");
            
            // Exibe o menu principal de consultas
            await sendWhatsAppButtons(from, "Qual consulta você deseja fazer?\n\n_Em caso de dúvidas, entre em contato com a nossa equipe no item \"AJUDA - SUPORTE\"_.", [
              { id: 'menu_essencial', title: 'VEICULAR - ESSENCIAL' },
              { id: 'menu_completa', title: 'VEICULAR - COMPLETA' },
              { id: 'menu_suporte', title: 'AJUDA - SUPORTE' }
            ]);
          } else {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'WAITING_DOCUMENT' }
            });
            await sendWhatsAppText(from, "Qual é o CNPJ da sua empresa?");
          }
          break;

        case 'COMPLETED':
          // Fluxo Principal Pós-Cadastro (Consultas ou Menus)
          if (textContent === 'menu_suporte' || textContent.toLowerCase().includes('suporte')) {
            await sendWhatsAppText(from, "🛠️ *Central de Suporte MobValor*\n\nNossa equipe está à disposição para ajudar com créditos ou dúvidas. Descreva sua solicitação abaixo que responderemos em breve!");
            return reply.status(200).send({ status: 'ok' });
          }

          if (textContent === 'menu_essencial' || textContent === 'menu_completa') {
            await sendWhatsAppText(from, "🚗 Por favor, envie a *Placa do Veículo* (ex: SNQ0E12) que deseja consultar:");
            return reply.status(200).send({ status: 'ok' });
          }

          // Se o usuário digitou uma placa diretamente (ex: SNQ0E12)
          const cleanPlate = textContent.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          if (cleanPlate.length === 7) {
            if (dealer.balance <= 0) {
              await sendWhatsAppText(from, "❌ Você não possui saldo suficiente para realizar esta consulta. Entre em contato com o suporte para recarregar.");
              return reply.status(200).send({ status: 'ok' });
            }

            // Desconta 1 crédito e realiza a consulta
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { balance: { decrement: 1 } }
            });

            await sendWhatsAppText(from, `🔍 Consultando placa *${cleanPlate}*...\n\n_Processo realizado com sucesso! (Saldo atual: ${dealer.balance - 1} consultas)_`);
          } else {
            // Reexibe o menu principal caso mande algo fora do padrão
            await sendWhatsAppButtons(from, "Escolha uma das opções abaixo:", [
              { id: 'menu_essencial', title: 'VEICULAR - ESSENCIAL' },
              { id: 'menu_completa', title: 'VEICULAR - COMPLETA' },
              { id: 'menu_suporte', title: 'AJUDA - SUPORTE' }
            ]);
          }
          break;
      }

      return reply.status(200).send({ status: 'success' });
    } catch (error) {
      console.error('❌ Erro crítico no webhook:', error);
      return reply.status(200).send({ status: 'error' });
    }
  });
}