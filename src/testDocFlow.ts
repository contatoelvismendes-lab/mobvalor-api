import fs from 'fs';
import path from 'path';
import { extrairDadosDocumento } from './services/crlvExtractorService';
import { consultarVeiculoInteligente } from './services/detranRouterService';

const CAMINHO_ARQUIVO_TESTE = path.resolve(__dirname, '../certs/crlv_exemplo.pdf');

async function testarFluxoCompleto() {
  console.log(`\n======================================================`);
  console.log(`🚀 MOBVALOR: EXTRAÇÃO CRLV + ROTEADOR INTELIGENTE DETRAN`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(CAMINHO_ARQUIVO_TESTE)) {
    console.error(`❌ Arquivo não encontrado: ${CAMINHO_ARQUIVO_TESTE}`);
    return;
  }

  const extensao = path.extname(CAMINHO_ARQUIVO_TESTE).toLowerCase();
  const mimeType = extensao === '.pdf' ? 'application/pdf' : 'image/jpeg';
  const buffer = fs.readFileSync(CAMINHO_ARQUIVO_TESTE);

  console.log(`🔍 [1] Extraindo dados do CRLV com Gemini 3.6 Flash...`);
  const dados = await extrairDadosDocumento(buffer, mimeType);

  if (!dados) {
    console.error(`❌ Não foi possível extrair dados do documento.`);
    return;
  }

  console.log(`\n✅ DADOS EXTRAÍDOS:`);
  console.log(`- Placa: ${dados.placa}`);
  console.log(`- Renavam: ${dados.renavam}`);
  console.log(`- Chassi: ${dados.chassi}`);
  console.log(`- UF: ${dados.uf || 'PE'}`);
  console.log(`- Proprietário: ${dados.nomeProprietario}`);

  console.log(`\n🔍 [2] Acionando Roteador de Detrans (Abertos / Unificado)...`);
  const resultado = await consultarVeiculoInteligente(dados);

  console.log(`\n======================================================`);
  console.log(`📊 RESULTADO DA CONSULTA VEICULAR:`);
  console.log(`======================================================`);
  console.log(`Status: ${resultado.sucesso ? '✅ SUCESSO' : '❌ ERRO'}`);
  console.log(`Tipo: ${resultado.tipoConsulta}`);
  console.log(`Endpoint: ${resultado.endpointUtilizado}`);
  console.log(`Custo API: R$ ${resultado.custoAproximado || '0.24'}`);

  if (resultado.sucesso) {
    if (resultado.debitos) {
      console.log(`\n💰 DÉBITOS / MULTAS / IPVA:`);
      console.log(JSON.stringify(resultado.debitos, null, 2));
    }
    if (resultado.restricoes) {
      console.log(`\n🔒 RESTRIÇÕES / GRAVAME (FINANCIAMENTO):`);
      console.log(JSON.stringify(resultado.restricoes, null, 2));
    }
    console.log(`\n📋 DADOS CADASTRAIS COMPLETOS:`);
    console.log(JSON.stringify(resultado.dadosCadastrais, null, 2));
  } else {
    console.error(`\nMotivo da falha: ${resultado.erro}`);
  }
}

testarFluxoCompleto();