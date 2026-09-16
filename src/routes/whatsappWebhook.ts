import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { DealerStateManager, DealerState } from '../services/dealerStateManager';

const prisma = new PrismaClient();

// Validar placa brasileira: ABC-1234 (padrão) ou ABC1D23 (Mercosul)
function validateBrazilianLicense(plate: string): boolean {
  const clean = plate.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

  // Padrão: 3 letras + 4 números (ABC1234)
  const standardPattern = /^[A-Z]{3}\d{4}$/;

  // Mercosul: 3 letras + 1 número + 1 letra + 2 números (ABC1D23)
  const mercosulPattern = /^[A-Z]{3}\d[A-Z]\d{2}$/;

  return standardPattern.test(clean) || mercosulPattern.test(clean);
}

async function sendWhatsAppText(to: string, text: string) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  await axios.post(
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
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
    `https://graph.facebook.com/v25.0/${phoneNumberId}/messages`,
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

// ============= STATE HANDLERS =============

async function handleMenuState(from: string, textContent: string) {
  console.log(`📋 HANDLER: Menu State`);

  if (textContent === 'menu_consulta' || textContent.includes('consulta')) {
    console.log(`🔍 Nova Consulta solicitada`);
    await DealerStateManager.setState(from, DealerState.WAITING_PLATE);

    await sendWhatsAppText(
      from,
      `🚗 *Nova Consulta*\n\nMe envie a placa do veículo que você quer consultar.\n\n*Ex.:* ABC-1234 ou ABC1D23\n\n💡 A qualquer momento, digite *cancelar* para voltar ao menu.`
    );
    console.log(`📤 Enviado: Instruções de placa\n`);
    return true;
  }

  if (textContent === 'menu_suporte' || textContent.includes('suporte')) {
    console.log(`💬 Suporte solicitado`);
    await sendWhatsAppText(
      from,
      `💬 *Falar com Suporte*\n\nNossa equipe está à disposição! Descreva sua solicitação abaixo.`
    );
    console.log(`📤 Enviado: Mensagem de suporte\n`);
    return true;
  }

  return false;
}

async function handleWaitingPlateState(from: string, textContent: string) {
  console.log(`📋 HANDLER: Waiting Plate State`);

  // Menu botões em estado de placa
  if (textContent === 'menu_consulta') {
    console.log(`🔄 Nova Consulta - Mantendo em WAITING_PLATE`);
    await sendWhatsAppText(
      from,
      `🚗 *Nova Consulta*\n\nMe envie a placa do veículo que você quer consultar.\n\n*Ex.:* ABC-1234 ou ABC1D23\n\n💡 A qualquer momento, digite *cancelar* para voltar ao menu.`
    );
    console.log(`📤 Enviado: Pedindo placa novamente\n`);
    return true;
  }

  if (textContent === 'menu_suporte') {
    console.log(`💬 Suporte solicitado do estado WAITING_PLATE`);
    await DealerStateManager.resetToMenu(from);
    await sendWhatsAppText(
      from,
      `💬 *Falar com Suporte*\n\nNossa equipe está à disposição! Descreva sua solicitação abaixo.`
    );
    console.log(`📤 Enviado: Mensagem de suporte\n`);
    return true;
  }

  if (textContent === 'cancelar') {
    console.log(`❌ Consulta cancelada`);
    await DealerStateManager.resetToMenu(from);

    await sendWhatsAppButtons(
      from,
      'Voltando ao menu...\n\nO que você deseja fazer?',
      [
        { id: 'menu_consulta', title: '🔍 Nova Consulta' },
        { id: 'menu_suporte', title: '💬 Falar com Suporte' }
      ]
    );
    console.log(`📤 Enviado: Menu\n`);
    return true;
  }

  // Verificar se é uma placa válida
  const cleanPlate = textContent.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleanPlate.length === 7 && validateBrazilianLicense(textContent)) {
    console.log(`🚗 PLACA RECEBIDA: ${cleanPlate}`);

    await DealerStateManager.savePlate(from, cleanPlate);

    await sendWhatsAppText(
      from,
      `🔍 *Consultando placa ${cleanPlate}...*\n\nAguarde um instante.`
    );

    // Checklist da Consulta Completa
    const consultaMessage = `✅ Placa ${cleanPlate} recebida!\n\n💎 *Consulta Completa — R$ 47,90*\n\nO que está incluído:\n✅ Informações Cadastrais\n✅ Identificação Técnica\n✅ Histórico de Proprietários\n✅ Débitos\n✅ Restrições Judiciais\n✅ Roubo e Furto\n✅ Gravame\n✅ Alienações\n✅ Sinistros\n✅ Recalls\n✅ Registro em Locadora\n✅ Aceitação em Seguradoras\n✅ Score do Veículo\n✅ Histórico de KM\n✅ Diversas Informações`;

    await sendWhatsAppText(from, consultaMessage);
    console.log(`📤 Enviado: Checklist`);

    // Botões de ação
    setTimeout(async () => {
      await sendWhatsAppButtons(
        from,
        'O que você deseja fazer?',
        [
          { id: 'efetuar_consulta', title: '✅ Efetuar Consulta' },
          { id: 'outras_consultas', title: '🔍 Outras Consultas' },
          { id: 'cancelar', title: '❌ Cancelar' }
        ]
      );
      console.log(`📤 Enviado: Botões de ação\n`);
    }, 1500);

    return true;
  }

  // Placa inválida
  if (cleanPlate.length === 7 || (cleanPlate.length > 0 && !validateBrazilianLicense(textContent))) {
    console.log(`❌ Placa inválida: ${textContent}`);

    await sendWhatsAppText(
      from,
      `❌ *Placa inválida!*\n\nOs formatos aceitos são:\n\n📋 *Padrão:* ABC-1234 (3 letras + 4 números)\n📋 *Mercosul:* ABC1D23 (3 letras + 1 número + 1 letra + 2 números)\n\n*Opções:*\n✏️ Digite novamente com o formato correto\n📷 Envie foto da placa do veículo\n📄 Envie CRLV (PDF ou foto)\n\n💡 Nosso time analisará e fará a consulta para você!`
    );

    setTimeout(async () => {
      await sendWhatsAppButtons(
        from,
        'O que você deseja fazer?',
        [
          { id: 'menu_consulta', title: '🔍 Nova Consulta' },
          { id: 'menu_suporte', title: '💬 Falar com Suporte' }
        ]
      );
      console.log(`📤 Enviado: Botões após placa inválida\n`);
    }, 500);

    return true;
  }

  return false;
}

async function handlePlateReceivedState(from: string, textContent: string) {
  console.log(`📋 HANDLER: Plate Received State`);

  const { dealer } = await DealerStateManager.getState(from);

  if (!dealer) {
    console.log(`❌ Dealer não encontrado`);
    return false;
  }

  // Nova Consulta / Outras Consultas (voltar a pedir placa)
  if (textContent === 'menu_consulta' || textContent === 'outras_consultas') {
    console.log(`🔄 Outras Consultas solicitadas`);
    await DealerStateManager.setState(from, DealerState.WAITING_PLATE);

    await sendWhatsAppText(
      from,
      `🚗 *Nova Consulta*\n\nMe envie a placa do veículo que você quer consultar.\n\n*Ex.:* ABC-1234 ou ABC1D23\n\n💡 A qualquer momento, digite *cancelar* para voltar ao menu.`
    );
    console.log(`📤 Enviado: Pedindo nova placa\n`);
    return true;
  }

  // Efetuar Consulta
  if (textContent === 'efetuar_consulta') {
    console.log(`✅ AÇÃO: Efetuar Consulta solicitada`);
    console.log(`📋 DEBUG: document="${dealer.document}" | email="${dealer.email}"`);

    // Verificar dados de cadastro
    if (!dealer.document || !dealer.email) {
      console.log(`❌ Cadastro incompleto - Pedindo dados`);
      await DealerStateManager.setState(from, DealerState.WAITING_REGISTRATION);

      await sendWhatsAppText(
        from,
        `📋 *Cadastro Incompleto*\n\nPreciso de alguns dados para prosseguir:\n\n1️⃣ CNPJ ou CPF\n2️⃣ Email\n\n*Envie seu CNPJ ou CPF*`
      );
      console.log(`📤 Enviado: Pedindo cadastro\n`);
      return true;
    }

    // Verificar saldo
    if (dealer.balance < 47.90) {
      console.log(`💰 Saldo insuficiente: R$ ${dealer.balance.toFixed(2)}`);

      await sendWhatsAppText(
        from,
        `💰 *Saldo Insuficiente!*\n\nVocê tem: R$ ${dealer.balance.toFixed(2)}\nNecessário: R$ 47,90`
      );

      await sendWhatsAppButtons(
        from,
        'O que você deseja fazer?',
        [
          { id: 'fazer_recarga', title: '💳 Fazer Recarga' },
          { id: 'menu_suporte', title: '💬 Suporte' },
          { id: 'voltar_menu', title: '⬅️ Menu Anterior' }
        ]
      );
      console.log(`📤 Enviado: Botões de saldo insuficiente\n`);
      return true;
    }

    // Debitar e processar consulta
    console.log(`💳 Debitando R$ 47,90 da conta`);
    await prisma.dealer.update({
      where: { whatsapp: from },
      data: { balance: dealer.balance - 47.90 }
    });

    await sendWhatsAppText(
      from,
      `✅ *Consulta Processada!*\n\n💳 Débito de R$ 47,90 realizado\n💰 Saldo: R$ ${(dealer.balance - 47.90).toFixed(2)}\n\n📋 A análise será entregue em breve!\n\n💜 Obrigado por usar a Mobvalor!`
    );
    console.log(`📤 Enviado: Confirmação de pagamento`);

    setTimeout(async () => {
      await DealerStateManager.resetToMenu(from);
      await sendWhatsAppButtons(
        from,
        'O que você deseja fazer?',
        [
          { id: 'menu_consulta', title: '🔍 Nova Consulta' },
          { id: 'menu_suporte', title: '💬 Falar com Suporte' }
        ]
      );
      console.log(`📤 Enviado: Voltando ao menu\n`);
    }, 2000);

    return true;
  }

  // Outras Consultas
  if (textContent === 'outras_consultas') {
    console.log(`🔄 Outras Consultas solicitadas`);
    await DealerStateManager.setState(from, DealerState.WAITING_PLATE);

    await sendWhatsAppText(
      from,
      `🚗 *Nova Consulta*\n\nMe envie a placa do veículo que você quer consultar.\n\n*Ex.:* ABC-1234 ou ABC1D23\n\n💡 A qualquer momento, digite *cancelar* para voltar ao menu.`
    );
    console.log(`📤 Enviado: Pedindo nova placa\n`);
    return true;
  }

  // Cancelar
  if (textContent === 'cancelar') {
    console.log(`❌ Operação cancelada`);
    await DealerStateManager.resetToMenu(from);

    await sendWhatsAppButtons(
      from,
      'Voltando ao menu...\n\nO que você deseja fazer?',
      [
        { id: 'menu_consulta', title: '🔍 Nova Consulta' },
        { id: 'menu_suporte', title: '💬 Falar com Suporte' }
      ]
    );
    console.log(`📤 Enviado: Menu\n`);
    return true;
  }

  // Fazer Recarga
  if (textContent === 'fazer_recarga') {
    console.log(`💳 Recarga solicitada`);
    await sendWhatsAppText(
      from,
      `💳 *Recarga Disponível*\n\nQual valor deseja recarregar?\n\n💵 *PIX* - 0% taxa\n💳 *Cartão* - 2.99% taxa\n\n🎁 Bônus de 5% acima de R$ 499\n\nResponda com o valor (ex: 100)`
    );
    console.log(`📤 Enviado: Opções de recarga\n`);
    return true;
  }

  // Voltar Menu
  if (textContent === 'voltar_menu') {
    console.log(`⬅️ Voltando ao menu`);
    await DealerStateManager.resetToMenu(from);

    await sendWhatsAppButtons(
      from,
      'Voltando ao menu...\n\nO que você deseja fazer?',
      [
        { id: 'menu_consulta', title: '🔍 Nova Consulta' },
        { id: 'menu_suporte', title: '💬 Falar com Suporte' }
      ]
    );
    console.log(`📤 Enviado: Menu\n`);
    return true;
  }

  return false;
}

async function handleWaitingRegistrationState(from: string, textContent: string, dealer: any) {
  console.log(`📋 HANDLER: Waiting Registration State`);

  // Validar CNPJ/CPF (simplificado: 11 ou 14 dígitos)
  const cleanDocument = textContent.replace(/\D/g, '');

  if (cleanDocument.length !== 11 && cleanDocument.length !== 14) {
    console.log(`❌ Documento inválido (${cleanDocument.length} dígitos)`);
    await sendWhatsAppText(
      from,
      `❌ *Documento inválido!*\n\n📝 Envie um CPF (11 dígitos) ou CNPJ (14 dígitos)\n\nEx: 12345678901 ou 12345678901234`
    );
    console.log(`📤 Enviado: Pedindo documento válido\n`);
    return true;
  }

  // Salvar documento
  console.log(`✅ Documento válido: ${cleanDocument}`);
  await prisma.dealer.update({
    where: { whatsapp: from },
    data: {
      document: cleanDocument,
      documentType: cleanDocument.length === 11 ? 'CPF' : 'CNPJ',
      context_data: { ...dealer.context_data, awaiting_email: true }
    }
  });

  await sendWhatsAppText(
    from,
    `✅ *Documento recebido!*\n\nAgora preciso do seu **email** para continuar.\n\n📧 *Envie um email válido*`
  );
  console.log(`📤 Enviado: Pedindo email\n`);
  return true;
}

async function handleAwaitingEmailState(from: string, textContent: string, dealer: any) {
  console.log(`📋 HANDLER: Awaiting Email State`);

  // Validar email simples
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(textContent)) {
    console.log(`❌ Email inválido`);
    await sendWhatsAppText(
      from,
      `❌ *Email inválido!*\n\n📧 Envie um email válido\n\nEx: seu@email.com`
    );
    console.log(`📤 Enviado: Pedindo email válido\n`);
    return true;
  }

  // Salvar email
  console.log(`✅ Email válido: ${textContent}`);
  await prisma.dealer.update({
    where: { whatsapp: from },
    data: {
      email: textContent,
      context_data: {}
    }
  });

  await sendWhatsAppText(
    from,
    `✅ *Cadastro completo!*\n\n✔️ Documento: ${dealer.document}\n✔️ Email: ${textContent}\n\n🎉 Agora você pode fazer consultas!`
  );
  console.log(`📤 Enviado: Cadastro concluído`);

  setTimeout(async () => {
    await DealerStateManager.resetToMenu(from);
    await sendWhatsAppButtons(
      from,
      'O que você deseja fazer?',
      [
        { id: 'menu_consulta', title: '🔍 Nova Consulta' },
        { id: 'menu_suporte', title: '💬 Falar com Suporte' }
      ]
    );
    console.log(`📤 Enviado: Voltando ao menu\n`);
  }, 1500);

  return true;
}

// ============= WEBHOOK ROUTES =============

export async function whatsappWebhookRoutes(app: FastifyInstance) {
  // Validação do webhook (GET)
  app.get('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const verifyToken = process.env.META_VERIFY_TOKEN;
    const query: any = request.query;

    const mode = query['hub.mode'];
    const token = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    console.log('🔍 Webhook validation received');

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ Webhook validado!');
      return reply.status(200).send(challenge);
    }

    console.error('❌ Validação falhou');
    return reply.status(403).send({ error: 'Validation failed' });
  });

  // Recebimento de mensagens (POST)
  app.post('/webhook/whatsapp', async (request: FastifyRequest, reply: FastifyReply) => {
    const body: any = request.body;

    try {
      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) {
        console.log('📭 Status update (sem mensagem)');
        return reply.status(200).send({ status: 'ignored' });
      }

      const from = message.from;
      const msgType = message.type;
      let textContent = '';

      console.log(`\n📱 [${'='.repeat(50)}]`);
      console.log(`📍 De: ${from}`);
      console.log(`📧 Tipo: ${msgType}`);

      if (msgType === 'text') {
        textContent = message.text.body.trim().toLowerCase();
        console.log(`💬 Conteúdo: "${textContent}"`);
      } else if (msgType === 'interactive') {
        textContent = message.interactive.button_reply.id;
        console.log(`🔘 Botão: ${textContent}`);
      } else {
        console.log(`⚠️ Tipo não suportado: ${msgType}`);
        return reply.status(200).send({ status: 'unsupported' });
      }

      // Encontrar ou criar dealer
      let dealer = await prisma.dealer.findUnique({ where: { whatsapp: from } });

      if (!dealer) {
        console.log(`👤 ❌ Novo dealer`);
        dealer = await prisma.dealer.create({
          data: {
            whatsapp: from,
            name: `Lojista ${from}`,
            email: null,
            balance: 10.0,
            state: DealerState.MENU
          }
        });
        console.log(`✅ Dealer criado! Saldo: R$ ${dealer.balance.toFixed(2)}`);

        // Bem-vindo
        await sendWhatsAppText(
          from,
          `🚗 *Bem-vindo à Mobvalor!* 💜\n\nConsulte veículos com rapidez e segurança, direto por aqui.`
        );

        // Menu inicial
        await sendWhatsAppButtons(
          from,
          'O que você deseja fazer?',
          [
            { id: 'menu_consulta', title: '🔍 Nova Consulta' },
            { id: 'menu_suporte', title: '💬 Falar com Suporte' }
          ]
        );
        console.log(`📤 Enviado: Bem-vindo + Menu\n`);
        return reply.status(200).send({ status: 'ok' });
      }

      console.log(`✅ Dealer encontrado. Estado: ${dealer.state}, Saldo: R$ ${dealer.balance.toFixed(2)}`);

      // ============= STATE MACHINE ROUTING =============
      const currentState = dealer.state as DealerState;

      if (currentState === DealerState.MENU) {
        const handled = await handleMenuState(from, textContent);
        if (handled) return reply.status(200).send({ status: 'ok' });
      }

      if (currentState === DealerState.WAITING_PLATE) {
        const handled = await handleWaitingPlateState(from, textContent);
        if (handled) return reply.status(200).send({ status: 'ok' });
      }

      if (currentState === DealerState.PLATE_RECEIVED) {
        const handled = await handlePlateReceivedState(from, textContent);
        if (handled) return reply.status(200).send({ status: 'ok' });
      }

      if (currentState === DealerState.WAITING_REGISTRATION) {
        const handled = await handleWaitingRegistrationState(from, textContent, dealer);
        if (handled) return reply.status(200).send({ status: 'ok' });
      }

      // Verificar se está aguardando email (salvo em context_data)
      const contextData = dealer.context_data as any;
      if (contextData && contextData.awaiting_email) {
        const handled = await handleAwaitingEmailState(from, textContent, dealer);
        if (handled) return reply.status(200).send({ status: 'ok' });
      }

      // Mensagem não reconhecida - resetar para MENU
      console.log(`❓ Mensagem não reconhecida para estado: ${currentState}, ressetando para MENU`);
      await DealerStateManager.resetToMenu(from);

      await sendWhatsAppButtons(
        from,
        'Não entendi. O que você deseja fazer?',
        [
          { id: 'menu_consulta', title: '🔍 Nova Consulta' },
          { id: 'menu_suporte', title: '💬 Falar com Suporte' }
        ]
      );
      console.log(`📤 Enviado: Menu padrão\n`);

      return reply.status(200).send({ status: 'ok' });
    } catch (error) {
      console.error('❌ Erro crítico:', error);
      return reply.status(200).send({ status: 'error' });
    }
  });
}
