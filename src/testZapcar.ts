import dotenv from 'dotenv';
import { checarAptidaoRenave } from './services/zapcarService';

dotenv.config();

const PLACA_TESTE = 'SNQ0E12';

async function testar() {
  console.log(`\n======================================================`);
  console.log(`🚗 MOBVALOR + ZAPCAR: AVALIAÇÃO DE APTIDÃO RENAVE`);
  console.log(`======================================================\n`);

  const resultado = await checarAptidaoRenave(PLACA_TESTE);

  console.log(`\n================ RESULTADO ================`);
  console.log(`Status da Requisição: ${resultado.sucesso ? '✅ SUCESSO' : '❌ ERRO'}`);
  console.log(`Apto para Entrada no Estoque (RENAVE): ${resultado.aptoRenave ? '✅ SIM (APTO)' : '🚫 NÃO (BLOQUEADO)'}`);

  if (resultado.alertas.length > 0) {
    console.log(`\n⚠️ Motivos / Alertas:`);
    resultado.alertas.forEach((a) => console.log(` - ${a}`));
  }

  if (resultado.sucesso) {
    console.log(`\n📄 Resumo Gravame Retornado:`);
    console.log(JSON.stringify(resultado.gravame?.dados || resultado.gravame, null, 2));
  }
}

testar();