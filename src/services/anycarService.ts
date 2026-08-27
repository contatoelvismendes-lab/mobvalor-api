import axios from 'axios';

const ANYCAR_API_URL = process.env.ANYCAR_API_URL || 'https://api.anycar.com.br';
const ANYCAR_API_KEY = process.env.ANYCAR_API_KEY || '';

const anycarClient = axios.create({
  baseURL: ANYCAR_API_URL,
  headers: {
    'x-api-key': ANYCAR_API_KEY,
    'Content-Type': 'application/json',
  },
});

export type AnycarConsultType = 
  | 'veicular-dados-basicos'
  | 'veicular-dados-avancados'
  | 'veicular-fipe'
  | 'veicular-leilao-1'
  | 'veicular-leilao-2'
  | 'veicular-sinistro-1'
  | 'veicular-roubo-furto'
  | 'veicular-indice-risco';

export async function consultarAnyCar(tipo: AnycarConsultType, placa: string, chassi?: string) {
  const payload: Record<string, string> = { tipo, placa: placa.toUpperCase().trim() };
  if (chassi) payload.chassi = chassi;

  const response = await anycarClient.post('/api/consultar', payload);
  return response.data;
}

export async function getAnyCarStatus() {
  const response = await anycarClient.get('/api/status');
  return response.data;
}