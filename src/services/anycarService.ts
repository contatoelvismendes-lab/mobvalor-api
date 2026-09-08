import axios from 'axios';

export interface AnyCarDadosVeiculo {
  marcaModelo?: string;
  modelo?: string;
  anoFabricacao?: string | number;
  anoModelo?: string | number;
  combustivel?: string;
  cor?: string;
  municipio?: string;
  uf?: string;
  chassi?: string;
}

export async function consultarAnyCar(placa: string): Promise<AnyCarDadosVeiculo | null> {
  try {
    const token = process.env.ANYCAR_API_TOKEN || process.env.ANYCAR_TOKEN;
    const url = `https://api.anycar.com.br/v1/consulta/${placa.toUpperCase()}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 10000,
    });

    const data = response.data?.dados || response.data;
    if (!data) return null;

    return {
      marcaModelo: data.marca_modelo || data.marcaModelo || data.modelo,
      modelo: data.modelo,
      anoFabricacao: data.ano_fabricacao || data.anoFabricacao,
      anoModelo: data.ano_modelo || data.anoModelo,
      combustivel: data.combustivel,
      cor: data.cor,
      municipio: data.municipio || data.cidade,
      uf: data.uf,
      chassi: data.chassi,
    };
  } catch (error: any) {
    console.error(`[AnyCar Service] Erro ao consultar placa ${placa}:`, error.message);
    return null;
  }
}