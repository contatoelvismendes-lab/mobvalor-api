import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.META_ACCESS_TOKEN || '';
const PHONE_ID = process.env.META_PHONE_NUMBER_ID || '';

async function verificarToken() {
  console.log('🔍 Verificando token WhatsApp...\n');

  try {
    const response = await axios.get(`https://graph.facebook.com/v25.0/me`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    console.log('✅ Token VÁLIDO!\n');
    console.log('📊 Informações:');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Name: ${response.data.name}`);

    return true;
  } catch (error: any) {
    console.error('❌ Token INVÁLIDO ou EXPIRADO');
    console.error(`   Erro: ${error.response?.data?.error?.message || error.message}`);
    console.error(`   Código: ${error.response?.data?.error?.code}\n`);

    return false;
  }
}

async function verificarPhoneNumber() {
  console.log('🔍 Verificando Phone Number ID...\n');

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v25.0/${PHONE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );

    console.log('✅ Phone ID VÁLIDO!\n');
    console.log('📊 Informações:');
    console.log(`   ID: ${response.data.id}`);
    console.log(`   Phone: ${response.data.phone_number_id}`);
    console.log(`   Status: ${response.data.status}`);

    return true;
  } catch (error: any) {
    console.error('❌ Phone ID INVÁLIDO');
    console.error(`   Erro: ${error.response?.data?.error?.message || error.message}`);
    console.error(`   Código: ${error.response?.data?.error?.code}\n`);

    return false;
  }
}

async function verificarPermissoes() {
  console.log('🔍 Verificando permissões do token...\n');

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v25.0/me/permissions`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );

    console.log('✅ Permissões do token:\n');
    const perms = response.data.data || [];

    if (perms.length === 0) {
      console.log('⚠️  Nenhuma permissão encontrada!');
    } else {
      perms.forEach((perm: any) => {
        const status = perm.status === 'granted' ? '✅' : '❌';
        console.log(`   ${status} ${perm.permission}`);
      });
    }

    const temPermissao = perms.some(
      (p: any) => p.permission === 'whatsapp_business_messaging' && p.status === 'granted'
    );

    if (!temPermissao) {
      console.log('\n⚠️  Permissão "whatsapp_business_messaging" NÃO concedida!');
      return false;
    }

    return true;
  } catch (error: any) {
    console.error('❌ Erro ao verificar permissões');
    console.error(`   Erro: ${error.response?.data?.error?.message || error.message}\n`);
    return false;
  }
}

async function main() {
  console.log('═══════════════════════════════════════');
  console.log('  🔐 DEBUG WhatsApp Meta/Facebook');
  console.log('═══════════════════════════════════════\n');

  console.log(`📌 Configurações:.env`);
  console.log(`   Token: ${TOKEN.slice(0, 20)}...${TOKEN.slice(-10)}`);
  console.log(`   Phone ID: ${PHONE_ID}\n`);

  if (!TOKEN || !PHONE_ID) {
    console.error('❌ Token ou Phone ID não configurados no .env');
    process.exit(1);
  }

  const tokenOk = await verificarToken();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (!tokenOk) {
    console.log('🔗 SOLUÇÃO: Gere um novo token em:');
    console.log('   https://developers.facebook.com/apps/');
    console.log('   → Sua App → WhatsApp → API Setup → Token de Acesso\n');
    process.exit(1);
  }

  const phoneOk = await verificarPhoneNumber();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const permsOk = await verificarPermissoes();
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (tokenOk && phoneOk && permsOk) {
    console.log('✅ TUDO OK! WhatsApp está configurado corretamente.\n');
    console.log('Teste de envio:');
    console.log('   npx tsx src/teste-whatsapp.ts 5581992086375\n');
  } else {
    console.log('❌ Há problemas com a configuração do WhatsApp.\n');
    console.log('Passos para resolver:');
    console.log('1. Acesse: https://developers.facebook.com/apps/');
    console.log('2. Selecione sua app WhatsApp');
    console.log('3. Gere um novo token (copie exatamente)');
    console.log('4. Cole em .env como META_ACCESS_TOKEN');
    console.log('5. Tente novamente\n');
  }
}

main().catch(console.error);
