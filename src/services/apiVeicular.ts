import 'dotenv/config';
import axios from 'axios';
import { infosimplesService, LaudoRenaveOn } from './infosimplesService';

export interface ConsultaRenaveON {
  veiculo: Record<string, unknown>;
  semaforo: string | boolean;
  totalDebitos: number;
  fipe: number | string;
  detalhes?: LaudoRenaveOn;
}

export interface ConsultaLeilaoCheck {
  placa: string;
  possuiLeilao: boolean;
  tipoLeilao: string;
  comitente: string;
  lote: string;
  dataLeilao: string;
  classificacaoMonta: string;
  possuiSinistro: boolean;
  desagioSugeridoPct: number;
  parecerComercial: string;
}

export interface UnifiedVehicleReport {
  placa: string;
  marca: string;
  modelo: string;
  anoModelo?: number;
  fipe: number;
  possuiLeilao: boolean;
  tipoLeilao?: string;
  comitente?: string;
  possuiSinistro: boolean;
  totalDebitos: number;
  aptoRenave: boolean;
  pendencias: string[];
  rawResponse: Record<string, any>;
}

const apiVeicular = {
  /**
   * Consulta os dados oficiais no DETRAN/RENAVE via Infosimples usando o Certificado A1.
   */
  async consultarRenaveON(placa: string, uf: string = 'PE'): Promise<ConsultaRenaveON> {
    const cleanPlate = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    // Se o token da Infosimples não estiver preenchido, usa o mock de desenvolvimento
    if (!process.env.INFOSIMPLES_API_TOKEN || process.env.INFOSIMPLES_API_TOKEN === 'SEU_TOKEN_AQUI') {
      return {
        veiculo: {
          placa: cleanPlate,
          marca: 'Volkswagen',
          modelo: 'Polo Track',
          ano: 2024,
        },
        semaforo: 'VERDE - Apto para RENAVE',
        totalDebitos: 0,
        fipe: 78500,
      };
    }

    const laudoRenave = await infosimplesService.gerarLaudoRenaveOn({
      placa: cleanPlate,
      uf,
    });

    const detranData = laudoRenave.detalhes?.detran?.data?.[0] || {};

    return {
      veiculo: detranData,
      semaforo: laudoRenave.aptoParaEntrada ? 'VERDE - Apto para RENAVE' : 'VERMELHO - Pendências Identificadas',
      totalDebitos: Number(detranData.total_debitos || 0),
      fipe: detranData.fipe_valor || detranData.valor_fipe || 0,
      detalhes: laudoRenave,
    };
  },

  /**
   * Consulta o histórico de leilão, sinistro e apontamentos de perda de valor comercial.
   */
  async consultarLeilaoCheck(placa: string): Promise<ConsultaLeilaoCheck> {
    const cleanPlate = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const url = process.env.API_VEICULAR_URL;
    const token = process.env.API_VEICULAR_TOKEN;

    // Se não tiver URL/Token específicos de leilão configurados, retorna fallback para testes
    if (!url || !token || url === 'https://api.consultasveiculares.com/v1' || token === 'SEU_TOKEN_AQUI') {
      return {
        placa: cleanPlate,
        possuiLeilao: true,
        tipoLeilao: 'Recuperado de Financiamento / Banco',
        comitente: 'Banco Santander S.A.',
        lote: 'Lote 1842',
        dataLeilao: '15/03/2023',
        classificacaoMonta: 'Sem Indício de Monta',
        possuiSinistro: false,
        desagioSugeridoPct: 18,
        parecerComercial: 'Risco comercial moderado: confirme a documentação e a origem antes de concluir a compra.',
      };
    }

    const { data } = await axios.get(url, {
      params: { placa: cleanPlate, consulta: 'leilao_check' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    return {
      placa: String(data.placa ?? cleanPlate),
      possuiLeilao: Boolean(data.possuiLeilao ?? data.possui_leilao),
      tipoLeilao: String(data.tipoLeilao ?? data.tipo_leilao ?? 'Não informado'),
      comitente: String(data.comitente ?? 'Não informado'),
      lote: String(data.lote ?? 'Não informado'),
      dataLeilao: String(data.dataLeilao ?? data.data_leilao ?? 'Não informado'),
      classificacaoMonta: String(data.classificacaoMonta ?? data.classificacao_monta ?? 'Não informado'),
      possuiSinistro: Boolean(data.possuiSinistro ?? data.possui_sinistro),
      desagioSugeridoPct: Number(data.desagioSugeridoPct ?? data.desagio_sugerido_pct ?? 0),
      parecerComercial: String(data.parecerComercial ?? data.parecer_comercial ?? 'Sem parecer comercial informado.'),
    };
  },

  /**
   * Consolidação unificada: executa ambas as consultas em paralelo para acelerar a resposta.
   */
  async consultarVeiculoCompleto(placa: string, uf: string = 'PE'): Promise<UnifiedVehicleReport> {
    const cleanPlate = placa.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

    const [dadosRenave, dadosLeilao] = await Promise.allSettled([
      this.consultarRenaveON(cleanPlate, uf),
      this.consultarLeilaoCheck(cleanPlate),
    ]);

    const renaveResult = dadosRenave.status === 'fulfilled' ? dadosRenave.value : null;
    const leilaoResult = dadosLeilao.status === 'fulfilled' ? dadosLeilao.value : null;

    const detranRaw = (renaveResult?.veiculo as Record<string, any>) || {};

    const marca = detranRaw.marca || (typeof detranRaw.marca_modelo === 'string' ? detranRaw.marca_modelo.split('/')[0] : 'N/D');
    const modelo = detranRaw.modelo || (typeof detranRaw.marca_modelo === 'string' ? detranRaw.marca_modelo.split('/')[1] : 'N/D');
    const anoModelo = detranRaw.ano_modelo || detranRaw.anoModelo ? Number(detranRaw.ano_modelo || detranRaw.anoModelo) : undefined;
    const fipe = Number(renaveResult?.fipe || 0);

    const aptoRenave = renaveResult?.detalhes ? renaveResult.detalhes.aptoParaEntrada : true;
    const pendencias = renaveResult?.detalhes ? renaveResult.detalhes.pendenciasIdentificadas : [];

    return {
      placa: cleanPlate,
      marca,
      modelo,
      anoModelo,
      fipe,
      possuiLeilao: Boolean(leilaoResult?.possuiLeilao),
      tipoLeilao: leilaoResult?.tipoLeilao,
      comitente: leilaoResult?.comitente,
      possuiSinistro: Boolean(leilaoResult?.possuiSinistro),
      totalDebitos: Number(renaveResult?.totalDebitos || 0),
      aptoRenave,
      pendencias,
      rawResponse: {
        renave: renaveResult,
        leilao: leilaoResult,
      },
    };
  },
};

export default apiVeicular;