import axios from 'axios';
import dotenv from 'dotenv';
import { DadosCRLVExtraidos } from './crlvExtractorService';

dotenv.config();

const INFOSIMPLES_TOKEN = process.env.INFOSIMPLES_API_TOKEN || '';

export interface RespostaPadronizadaVeiculo {
  sucesso: boolean;
  uf: string;
  tipoConsulta: 'DETRAN_DIRETO_EXTRATO' | 'DETRAN_UNIFICADO_RESTRICOES';
  endpointUtilizado: string;
  custoAproximado?: string;
  debitos?: any;
  restricoes?: any;
  dadosCadastrais?: any;
  bruto?: any;
  erro?: string;
}

/**
 * Consulta unificada nacional (detran/restricoes)
 */
async function consultarDetranUnificado(dados: DadosCRLVExtraidos): Promise<RespostaPadronizadaVeiculo> {
  const uf = (dados.uf || 'PE').toUpperCase().trim();
  const endpoint = 'https://api.infosimples.com/api/v2/consultas/detran/restricoes';

  const payload: Record<string, any> = {
    token: INFOSIMPLES_TOKEN,
    timeout: 300,
    placa: dados.placa?.trim().toUpperCase(),
    uf: uf,
  };

  if (dados.renavam?.trim()) payload.renavam = dados.renavam.trim();
  if (dados.chassi?.trim()) payload.chassi = dados.chassi.trim().toUpperCase();

  console.log(`🌐 [Rota 2 - Unificada] Disparando detran/restricoes...`);

  try {
    const resp = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    if (resp.data?.code === 200) {
      const item = resp.data?.data?.[0] || {};
      return {
        sucesso: true,
        uf,
        tipoConsulta: 'DETRAN_UNIFICADO_RESTRICOES',
        endpointUtilizado: 'detran/restricoes',
        custoAproximado: resp.data?.header?.price || '0.24 - 0.30',
        restricoes: item.restricoes || item,
        dadosCadastrais: item,
        bruto: item,
      };
    }

    const msgErro = resp.data?.errors?.join(', ') || resp.data?.code_message;
    return {
      sucesso: false,
      uf,
      tipoConsulta: 'DETRAN_UNIFICADO_RESTRICOES',
      endpointUtilizado: 'detran/restricoes',
      erro: `${resp.data?.code} - ${msgErro}`,
    };
  } catch (err: any) {
    const apiErr = err.response?.data?.errors?.join(', ') || err.response?.data?.code_message || err.message;
    return {
      sucesso: false,
      uf,
      tipoConsulta: 'DETRAN_UNIFICADO_RESTRICOES',
      endpointUtilizado: 'detran/restricoes',
      erro: apiErr,
    };
  }
}

/**
 * Consulta estadual direta de Pernambuco (detran/pe/veiculo)
 * Retorna dados cadastrais, débitos resumidos e restrições financeiras.
 */
async function consultarDetranPEDireto(dados: DadosCRLVExtraidos): Promise<RespostaPadronizadaVeiculo | null> {
  const endpoint = 'https://api.infosimples.com/api/v2/consultas/detran/pe/veiculo';

  console.log(`📍 [Rota 1 - Detran Aberto] Consultando detran/pe/veiculo (Placa: ${dados.placa})...`);

  try {
    const resp = await axios.post(
      endpoint,
      {
        token: INFOSIMPLES_TOKEN,
        timeout: 300,
        placa: dados.placa?.trim().toUpperCase(),
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );

    if (resp.data?.code === 200) {
      const item = resp.data?.data?.[0] || {};
      return {
        sucesso: true,
        uf: 'PE',
        tipoConsulta: 'DETRAN_DIRETO_EXTRATO',
        endpointUtilizado: 'detran/pe/veiculo',
        custoAproximado: resp.data?.header?.price || '0.24',
        debitos: item.debitos || item.resumo_debitos || item.valores || {},
        restricoes: {
          gravame: item.restricoes_financeiras || item.gravame || item.restricoes || 'Sem restrições explícitas',
          judicial: item.restricoes_judiciais || 'Nenhuma',
        },
        dadosCadastrais: item,
        bruto: item,
      };
    }

    console.warn(`⚠️ [Rota 1 - PE] Retornou código ${resp.data?.code}: ${resp.data?.code_message}`);
    if (resp.data?.errors?.length) console.warn(`   Detalhe: ${resp.data.errors.join(', ')}`);
    return null;
  } catch (err: any) {
    console.warn(`⚠️ [Rota 1 - PE] Erro de requisição: ${err.message}`);
    return null;
  }
}

/**
 * Roteador MobValor: decide o endpoint estadual ideal ou recorre à rota unificada
 */
export async function consultarVeiculoInteligente(
  dados: DadosCRLVExtraidos
): Promise<RespostaPadronizadaVeiculo> {
  const uf = (dados.uf || 'PE').toUpperCase().trim();

  if (!dados.placa) {
    return {
      sucesso: false,
      uf,
      tipoConsulta: 'DETRAN_UNIFICADO_RESTRICOES',
      endpointUtilizado: 'nenhum',
      erro: 'Placa obrigatória não identificada no documento.',
    };
  }

  // Se for Pernambuco, tenta a consulta estadual direta
  if (uf === 'PE') {
    const resultadoPE = await consultarDetranPEDireto(dados);
    if (resultadoPE && resultadoPE.sucesso) {
      return resultadoPE;
    }
    console.warn(`[Detran Router] Detran-PE falhou ou oscilou. Acionando rota unificada de restrições...`);
  }

  // Fallback ou outros estados
  return await consultarDetranUnificado(dados);
}