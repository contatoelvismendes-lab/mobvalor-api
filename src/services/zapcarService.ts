import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const ZAPCAR_TOKEN = process.env.ZAPCAR_API_TOKEN || '';
const BASE_URL = 'https://api.zapcarconsulta.com.br/v1';

export interface RetornoValidacaoRenave {
  sucesso: boolean;
  aptoRenave: boolean;
  alertas: string[];
  gravame?: any;
  renajud?: any;
  erro?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Cria a consulta assíncrona na ZapCar e aguarda a conclusão (Polling)
 */
async function executarConsultaZapCar(servico: 'gravame' | 'renajud', placa: string): Promise<any> {
  const placaLimpa = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  const headers = {
    Authorization: `Bearer ${ZAPCAR_TOKEN}`,
    'Content-Type': 'application/json',
  };

  // 1. Criar Consulta
  const resCriacao = await axios.post(
    `${BASE_URL}/consultas`,
    { servico, placa: placaLimpa },
    { headers, timeout: 30000 }
  );

  const idConsulta = resCriacao.data?.id;
  if (!idConsulta) {
    throw new Error(`Falha ao registrar consulta de ${servico}: Sem ID`);
  }

  // 2. Polling até status !== "processando" (máximo 45 segundos)
  const maxTentativas = 20;
  for (let i = 0; i < maxTentativas; i++) {
    await delay(1500);

    const resCheck = await axios.get(`${BASE_URL}/consultas/${idConsulta}`, { headers });
    const status = resCheck.data?.status;

    if (status === 'concluido') {
      return resCheck.data;
    }

    if (status === 'erro') {
      throw new Error(resCheck.data?.erro || `Falha na consulta (${resCheck.data?.erro_codigo})`);
    }
  }

  throw new Error(`Tempo limite esgotado para a consulta de ${servico}`);
}

/**
 * Validação de Aptidão para RENAVE (Gravame + Renajud)
 */
export async function checarAptidaoRenave(placa: string): Promise<RetornoValidacaoRenave> {
  const alertas: string[] = [];
  let gravameData: any = null;
  let renajudData: any = null;

  try {
    // 1. Executa Gravame (R$ 6,99)
    console.log(`📡 [ZapCar] Disparando consulta de Gravame para ${placa}...`);
    gravameData = await executarConsultaZapCar('gravame', placa);

    const veiculoGravame = gravameData?.dados?.veiculo || gravameData?.veiculo || {};
    const restricoes = veiculoGravame?.restricoes || [];
    
    // Procura restrição financeira ativa
    const restriFinanceira = restricoes.find((r: any) => r.tipo === 'FINANCEIRA' && r.ativa === true);
    if (restriFinanceira) {
      alertas.push(`Gravame / Alienação Fiduciária ativa: ${restriFinanceira.descricao || 'Sim'}`);
    }

    // 2. Executa Renajud (R$ 6,99)
    console.log(`📡 [ZapCar] Disparando consulta de Renajud para ${placa}...`);
    renajudData = await executarConsultaZapCar('renajud', placa);

    const veiculoRenajud = renajudData?.dados?.veiculo || renajudData?.veiculo || {};
    const restricoesRenajud = veiculoRenajud?.restricoes || [];

    // Procura restrição judicial ativa
    const restriJudicial = restricoesRenajud.find((r: any) => r.tipo === 'RENAJUD' && r.ativa === true);
    if (restriJudicial) {
      alertas.push(`Restrição Judicial RENAJUD ativa: ${restriJudicial.descricao || 'Bloqueio de transferência'}`);
    }

    return {
      sucesso: true,
      aptoRenave: alertas.length === 0,
      alertas,
      gravame: gravameData,
      renajud: renajudData,
    };
  } catch (err: any) {
    const msgErro = err.response?.data?.erro || err.message;
    console.error(`❌ [ZapCar] Erro na esteira: ${msgErro}`);
    return {
      sucesso: false,
      aptoRenave: false,
      alertas: [`Falha na validação ZapCar: ${msgErro}`],
      erro: msgErro,
    };
  }
}