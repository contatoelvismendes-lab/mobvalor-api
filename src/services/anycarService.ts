import axios from 'axios';

export interface AnyCarDadosVeiculo {
  placa?: string;
  renavam?: string;
  chassi?: string;
  marcaModelo?: string;
  modelo?: string;
  anoFabricacao?: string | number;
  anoModelo?: string | number;
  combustivel?: string;
  cor?: string;
  municipio?: string;
  uf?: string;
}

export async function consultarAnyCar(placa: string): Promise<AnyCarDadosVeiculo | null> {
  try {
    const token =
      process.env.ANYCAR_API_KEY ||
      process.env.ANYCAR_API_TOKEN ||
      process.env.ANYCAR_TOKEN;

    if (!token) {
      console.error('[AnyCar Service] ❌ Chave ANYCAR_API_KEY ausente no .env');
      return null;
    }

    const placaLimpa = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Rotas oficiais documentadas na API AnyCar
    const rotas = [
      `https://api.anycar.com.br/v1/veiculo/${placaLimpa}`,
      `https://api.anycar.com.br/v1/consulta/${placaLimpa}`,
      `https://api.anycar.com.br/v1/placa/${placaLimpa}`,
    ];

    for (const url of rotas) {
      try {
        const response = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 10000,
        });

        const raw = response.data;
        const data = raw?.dados || raw?.data || raw;

        if (data && (data.renavam || data.chassi || data.marca_modelo)) {
          return {
            placa: data.placa || placaLimpa,
            renavam:
              data.renavam ||
              data.Renavam ||
              data.codigo_renavam ||
              data.num_renavam,
            chassi: data.chassi || data.Chassi,
            marcaModelo: data.marca_modelo || data.marcaModelo || data.modelo,
            modelo: data.modelo,
            anoFabricacao: data.ano_fabricacao || data.anoFabricacao,
            anoModelo: data.ano_modelo || data.anoModelo,
            combustivel: data.combustivel,
            cor: data.cor,
            municipio: data.municipio || data.cidade,
            uf: data.uf,
          };
        }
      } catch (err: any) {
        if (err.response?.status !== 404) {
          console.warn(`[AnyCar Service] Tentativa em ${url} retornou ${err.response?.status || err.message}`);
        }
      }
    }

    return null;
  } catch (error: any) {
    console.error(`[AnyCar Service] Erro geral ao consultar ${placa}:`, error.message);
    return null;
  }
}