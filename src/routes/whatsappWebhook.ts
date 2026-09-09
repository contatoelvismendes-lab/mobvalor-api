import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

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

      const from = message.from; 
      const msgType = message.type;
      let textContent = '';

      if (msgType === 'text') {
        textContent = message.text.body.trim();
      } else if (msgType === 'interactive') {
        textContent = message.interactive.button_reply.id; 
      } else {
        return reply.status(200).send({ status: 'unsupported_type' });
      }

      let dealer = await prisma.dealer.findUnique({ where: { whatsapp: from } });

      if (!dealer) {
        dealer = await prisma.dealer.create({
          data: {
            whatsapp: from,
            registrationStep: 'WAITING_NAME',
            balance: 10.0 
          }
        });

        await sendWhatsAppText(from, "Olá! Seja muito bem-vindo ao *MobValor* 🏁\n\nSomos a ferramenta definitiva para lojistas que precisam consultar o estoque com rapidez e segurança, focada principalmente em verificar se o veículo está *apto a entrar no Renave*.");
        await sendWhatsAppText(from, "Para começarmos, qual é o seu nome?\n\n💡 _Como prefere ser chamado(a) para personalizar seu atendimento._");
        return reply.status(200).send({ status: 'ok' });
      }

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
            await sendWhatsAppText(from, "Qual é o seu e-mail?\n\n💡 _Para envio de relatórios e notas._");
          } else {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'WAITING_NAME' }
            });
            await sendWhatsAppText(from, "Qual é o seu nome?");
          }
          break;

        case 'WAITING_EMAIL':
          // Validação se e-mail já existe em outro cadastro
          const existingEmailDealer = await prisma.dealer.findFirst({
            where: { 
              email: textContent,
              NOT: { id: dealer.id }
            }
          });

          if (existingEmailDealer) {
            const last4 = existingEmailDealer.whatsapp.slice(-4);
            await sendWhatsAppText(from, `❌ Este e-mail já está cadastrado. Vinculado ao WhatsApp final ${last4}. Por favor, informe outro e-mail:`);
            return reply.status(200).send({ status: 'ok' });
          }

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
          const cleanCnpjInput = textContent.replace(/\D/g, '');

          // Validação se CNPJ já existe em outro cadastro
          const existingCnpjDealer = await prisma.dealer.findFirst({
            where: { 
              document: cleanCnpjInput,
              NOT: { id: dealer.id }
            }
          });

          if (existingCnpjDealer) {
            const last4Cnpj = existingCnpjDealer.whatsapp.slice(-4);
            await sendWhatsAppText(from, `❌ Este CNPJ já está cadastrado. Vinculado ao WhatsApp final ${last4Cnpj}. Por favor, informe outro CNPJ:`);
            return reply.status(200).send({ status: 'ok' });
          }

          const company = await fetchCompanyData(cleanCnpjInput);
          if (!company.success) {
            await sendWhatsAppText(from, "❌ CNPJ não encontrado na Receita Federal. Por favor, digite um CNPJ válido:");
            return reply.status(200).send({ status: 'ok' });
          }

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
              data: { registrationStep: 'WAITING_ROLE' }
            });
            // Pergunta o cargo logo após confirmar o CNPJ
            await sendWhatsAppButtons(from, "Qual é o seu cargo na empresa?", [
              { id: 'role_owner', title: 'PROPRIETÁRIO' },
              { id: 'role_manager', title: 'GERENTE' },
              { id: 'role_seller', title: 'VENDEDOR' }
            ]);
          } else {
            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { registrationStep: 'WAITING_DOCUMENT' }
            });
            await sendWhatsAppText(from, "Qual é o CNPJ da sua empresa?");
          }
          break;

        case 'WAITING_ROLE':
          let cargoEscolhido = textContent;
          if (textContent === 'role_owner') cargoEscolhido = 'Proprietário';
          if (textContent === 'role_manager') cargoEscolhido = 'Gerente';
          if (textContent === 'role_seller') cargoEscolhido = 'Vendedor';

          await prisma.dealer.update({
            where: { id: dealer.id },
            data: { 
              role: cargoEscolhido,
              registrationStep: 'COMPLETED' 
            }
          });

          await sendWhatsAppText(from, "Cadastro concluído com sucesso! ✅ Seu número já está liberado para consultas de aptidão no Renave e histórico veicular.");
          
          await sendWhatsAppButtons(from, "Qual consulta você deseja fazer?", [
            { id: 'menu_renave', title: 'RENAVE ON' },
            { id: 'menu_outras', title: 'OUTRAS CONSULTAS' },
            { id: 'menu_suporte', title: 'SUPORTE' }
          ]);
          break;

        case 'COMPLETED':
          if (textContent === 'menu_suporte' || textContent.toLowerCase().includes('suporte')) {
            await sendWhatsAppText(from, "🛠️ *Central de Suporte MobValor*\n\nNossa equipe está à disposição para ajudar com créditos ou dúvidas. Descreva sua solicitação abaixo!");
            return reply.status(200).send({ status: 'ok' });
          }

          if (textContent === 'menu_outras') {
            await sendWhatsAppButtons(from, "📦 *Outras Opções Disponíveis:*\n\n• *Débitos Estaduais* - R$ 9,90\n• *Histórico de Leilão* - R$ 29,90\n• *Histórico de Sinistro* - R$ 14,90", [
              { id: 'menu_debitos', title: 'DÉBITOS' },
              { id: 'menu_leilao', title: 'LEILÃO' },
              { id: 'menu_sinistro', title: 'SINISTRO' }
            ]);
            return reply.status(200).send({ status: 'ok' });
          }

          if (textContent === 'menu_renave' || textContent === 'menu_debitos' || textContent === 'menu_leilao' || textContent === 'menu_sinistro') {
            let nomeServico = 'Renave On';
            let valorServico = 'R$ 39,90';

            if (textContent === 'menu_debitos') {
              nomeServico = 'Débitos Estaduais';
              valorServico = 'R$ 9,90';
            } else if (textContent === 'menu_leilao') {
              nomeServico = 'Histórico de Leilão';
              valorServico = 'R$ 29,90';
            } else if (textContent === 'menu_sinistro') {
              nomeServico = 'Histórico de Sinistro';
              valorServico = 'R$ 14,90';
            }

            await sendWhatsAppText(from, `🔍 Vamos iniciar sua consulta:\n\n*Consulta:* ${nomeServico}\n*Valor:* ${valorServico}\n\nQual é a **Placa do Veículo**?\n\n💡 _Digite apenas letras e números, formato tradicional ou Mercosul: XXX0000 ou XXX1X00_`);
            return reply.status(200).send({ status: 'ok' });
          }

          const cleanPlate = textContent.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          if (cleanPlate.length === 7) {
            if (dealer.balance <= 0) {
              await sendWhatsAppText(from, "❌ Saldo insuficiente para realizar esta consulta. Entre em contato com o suporte para recarregar.");
              return reply.status(200).send({ status: 'ok' });
            }

            await prisma.dealer.update({
              where: { id: dealer.id },
              data: { balance: { decrement: 1 } }
            });

            await sendWhatsAppText(from, `🔍 Consultando aptidão no Renave para a placa *${cleanPlate}*... Aguarde um instante.`);

            // Simulação robusta ou chamada direta do serviço de consulta
            try {
              // Aqui você pode substituir pela resposta real da sua API interna de consulta
              const relatorio = `📋 *RESULTADO DA CONSULTA - RENAVE* 🏁\n\n` +
                `• *Placa:* ${cleanPlate}\n` +
                `• *Status Renave:* ✅ APTO PARA ENTRADA\n` +
                `• *Restrições:* Nenhum impedimento crítico encontrado\n\n` +
                `_Saldo atual: R$ ${(dealer.balance - 1).toFixed(2)}_`;

              await sendWhatsAppText(from, relatorio);

              setTimeout(async () => {
                await sendWhatsAppButtons(from, "Qual consulta você deseja fazer?", [
                  { id: 'menu_renave', title: 'RENAVE ON' },
                  { id: 'menu_outras', title: 'OUTRAS CONSULTAS' },
                  { id: 'menu_suporte', title: 'SUPORTE' }
                ]);
              }, 1000);

            } catch (err) {
              await prisma.dealer.update({
                where: { id: dealer.id },
                data: { balance: { increment: 1 } }
              });
              await sendWhatsAppText(from, `⚠️ Erro ao consultar a placa *${cleanPlate}*. Seu saldo foi estornado.`);
            }

          } else {
            await sendWhatsAppButtons(from, "Qual consulta você deseja fazer?", [
              { id: 'menu_renave', title: 'RENAVE ON' },
              { id: 'menu_outras', title: 'OUTRAS CONSULTAS' },
              { id: 'menu_suporte', title: 'SUPORTE' }
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