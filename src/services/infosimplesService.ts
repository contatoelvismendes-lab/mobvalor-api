import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

export interface LaudoRenaveOn {
  aptoParaEntrada: boolean;
  totalPendencias: number;
  pendenciasIdentificadas: string[];
  detalhes: {
    detran: any;
    multasPrf?: any;
  };
}

export interface ConsultaVeiculoParams {
  placa: string;
  renavam?: string;
  chassi?: string;
  cpf_cnpj?: string;
  uf?: string;
}

export class InfosimplesService {
  private apiToken: string;
  private baseUrl: string = 'https://api.infosimples.com/api/v2/consultas';
  private certBase64: string | null = null;
  private certPassword: string | null = null;

  // Mapeamento correto dos endpoints oficiais por estado na Infosimples
  private detranEndpoints: Record<string, string> = {
    pe: 'detran/pe/veiculo',
    sp: 'detran/sp/debitos-restricoes',
    mg: 'detran/mg/veiculo',
    pr: 'detran/pr/veiculo',
    rj: 'detran/rj/multas-bradesco',
    ba: 'detran/ba/veiculo',
    sc: 'detran/sc/veiculo',
    rs: 'detran/rs/veiculo',
    go: 'detran/go/veiculo',
    ce: 'detran/ce/veiculo',
    pa: 'detran/pa/veiculo',
    es: 'detran/es/veiculo',
  };

  constructor() {
    this.apiToken = (process.env.INFOSIMPLES_API_TOKEN || '').trim();
    if (!this.apiToken) {
      console.warn('[InfosimplesService] AVISO: INFOSIMPLES_API_TOKEN não configurado no .env.');
    }

    this.carregarCertificado();
  }

  // Carrega o certificado A1 local (.pfx) e converte em Base64
  private carregarCertificado(): void {
    try {
      const certPath = process.env.CERT_PATH;
      this.certPassword = process.env.CERT_PASSWORD || null;

      if (!certPath) {
        console.warn('[InfosimplesService] AVISO: CERT_PATH não informado no .env.');
        return;
      }

      const fullPath = path.resolve(certPath);
      if (fs.existsSync(fullPath)) {
        const fileBuffer = fs.readFileSync(fullPath);
        this.certBase64 = fileBuffer.toString('base64');
        console.log('[InfosimplesService] Certificado A1 carregado com sucesso.');
      } else {
        console.warn(`[InfosimplesService] Arquivo de certificado não encontrado no caminho: ${fullPath}`);
      }
    } catch (error: any) {
      console.error('[InfosimplesService] Erro ao carregar o arquivo .pfx:', error.message);
    }
  }

  private async consultarEndpoint(serviceEndpoint: string, params: Record<string, any>, timeoutSec: number = 35): Promise<any> {
    const token = this.apiToken || (process.env.INFOSIMPLES_API_TOKEN || '').trim();

    if (!token) {
      return { code: 401, error: 'Token da Infosimples não configurado.' };
    }

    // Injeta credenciais do certificado A1 se disponíveis
    const payload: Record<string, any> = {
      token,
      timeout: timeoutSec,
      ...params,
    };

    if (this.certBase64 && this.certPassword) {
      payload.pkcs12_cert = this.certBase64;
      payload.pkcs12_pass = this.certPassword;
    }

    try {
      console.log(`[Infosimples] Chamando: ${serviceEndpoint}...`);

      const response = await axios.post(
        `${this.baseUrl}/${serviceEndpoint}`,
        payload,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: (timeoutSec + 10) * 1000,
        }
      );

      console.log(`[Infosimples] Resposta (${serviceEndpoint}) - Code:`, response.data?.code);
      return response.data;
    } catch (error: any) {
      const status = error.response?.status;
      const data = error.response?.data;
      console.error(`[Infosimples] Erro em ${serviceEndpoint}:`, JSON.stringify(data || error.message));
      return {
        code: status || 500,
        sucesso: false,
        detalhesErro: data || error.message,
      };
    }
  }

  async gerarLaudoRenaveOn(params: ConsultaVeiculoParams): Promise<LaudoRenaveOn> {
    const { placa, renavam = '', chassi = '', cpf_cnpj = '', uf = 'PE' } = params;
    const cleanPlate = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const ufLimpa = uf.trim().toLowerCase();
    const pendencias: string[] = [];

    const endpointDetran = this.detranEndpoints[ufLimpa] || `detran/${ufLimpa}/veiculo`;

    const paramsDetran: Record<string, any> = {
      placa: cleanPlate,
    };
    if (renavam) paramsDetran.renavam = renavam.trim();
    if (chassi) paramsDetran.chassi = chassi.trim();
    if (cpf_cnpj) paramsDetran.cpf_cnpj = cpf_cnpj.replace(/\D/g, '');

    // Consulta Detran Estadual autenticada com A1
    const detranData = await this.consultarEndpoint(endpointDetran, paramsDetran, 35);

    // Processamento dos dados retornados
    const dadosDetran = detranData?.data?.[0];
    if (dadosDetran) {
      if (dadosDetran.restricoes) {
        if (Array.isArray(dadosDetran.restricoes)) {
          dadosDetran.restricoes.forEach((r: any) => {
            const descricao = typeof r === 'string' ? r : (r.descricao || r.tipo || 'Restrição DETRAN');
            pendencias.push(`Restrição DETRAN: ${descricao}`);
          });
        } else if (typeof dadosDetran.restricoes === 'string' && dadosDetran.restricoes.trim() !== '') {
          pendencias.push(`Restrição DETRAN: ${dadosDetran.restricoes}`);
        }
      }

      if (dadosDetran.gravame || dadosDetran.alienacao_fiduciaria || dadosDetran.restricao_financeira || dadosDetran.tem_gravame) {
        if (!pendencias.some(p => p.toLowerCase().includes('gravame') || p.toLowerCase().includes('financeira'))) {
          pendencias.push('Alienação Fiduciária / Gravame Ativo');
        }
      }

      if (dadosDetran.bloqueio_judicial || dadosDetran.restricao_judicial || dadosDetran.renajud) {
        pendencias.push('Bloqueio Judicial Ativo (RENAJUD)');
      }

      if (dadosDetran.roubo_furto || dadosDetran.restricao_roubo_furto) {
        pendencias.push('ALERTA: Veículo com restrição de Roubo/Furto');
      }

      if (dadosDetran.total_debitos && Number(dadosDetran.total_debitos) > 0) {
        pendencias.push(`Débitos pendentes no Detran: R$ ${dadosDetran.total_debitos}`);
      }
    }

    const apto = pendencias.length === 0;

    return {
      aptoParaEntrada: apto,
      totalPendencias: pendencias.length,
      pendenciasIdentificadas: pendencias,
      detalhes: {
        detran: detranData,
      },
    };
  }
}

export const infosimplesService = new InfosimplesService();