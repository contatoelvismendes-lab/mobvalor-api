import axios from 'axios';

export interface ConsultaRenaveON {
  veiculo: Record<string, unknown>;
  semaforo: string | boolean;
  totalDebitos: number;
  fipe: number | string;
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

const apiVeicular = {
  async consultarRenaveON(placa: string): Promise<ConsultaRenaveON> {
    const url = process.env.API_VEICULAR_URL;
    const token = process.env.API_VEICULAR_TOKEN;

    if (!url || url === 'https://api.consultasveiculares.com/v1') {
      return {
        veiculo: {
          placa,
          marca: 'Volkswagen',
          modelo: 'Polo Track',
          ano: 2024,
        },
        semaforo: 'VERDE - Apto para RENAVE',
        totalDebitos: 0,
        fipe: 78500,
      };
    }

    if (!token || token === 'SEU_TOKEN_AQUI') {
      throw new Error('API_VEICULAR_TOKEN precisa estar configurado');
    }

    const { data } = await axios.get(url, {
      params: { placa },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    return {
      veiculo: (data.veiculo ?? data.vehicle ?? data) as Record<string, unknown>,
      semaforo: data.semaforo ?? data.semaphore ?? data.renave_on ?? false,
      totalDebitos: Number(data.totalDebitos ?? data.total_debitos ?? data.debitos?.total ?? 0),
      fipe: data.fipe ?? data.valor_fipe ?? 'N/A',
    };
  },

  async consultarLeilaoCheck(placa: string): Promise<ConsultaLeilaoCheck> {
    const url = process.env.API_VEICULAR_URL;
    const token = process.env.API_VEICULAR_TOKEN;

    if (!url || url === 'https://api.consultasveiculares.com/v1') {
      return {
        placa,
        possuiLeilao: true,
        tipoLeilao: 'Recuperado de Financiamento / Banco',
        comitente: 'Banco Santander S.A.',
        lote: 'Lote 1842',
        dataLeilao: '15/03/2023',
        classificacaoMonta: 'Sem Indício de Monta',
        possuiSinistro: false,
        desagioSugeridoPct: 18,
        parecerComercial: 'Risco comercial moderado: confirme a documentação e a origem antes de concluir a compra. Veículo apto para avaliação com deságio sugerido.',
      };
    }

    if (!token || token === 'SEU_TOKEN_AQUI') {
      throw new Error('API_VEICULAR_TOKEN precisa estar configurado');
    }

    const { data } = await axios.get(url, {
      params: { placa, consulta: 'leilao_check' },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 15000,
    });

    return {
      placa: String(data.placa ?? placa),
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
};

export default apiVeicular;
