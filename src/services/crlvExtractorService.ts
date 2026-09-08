import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

export interface DadosCRLVExtraidos {
  placa?: string;
  renavam?: string;
  chassi?: string;
  uf?: string;
  cpfCnpjProprietario?: string;
  nomeProprietario?: string;
  marcaModelo?: string;
  anoFabricacao?: string;
  anoModelo?: string;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function extrairDadosDocumento(
  buffer: Buffer,
  mimeType: string
): Promise<DadosCRLVExtraidos | null> {
  if (!apiKey) {
    console.error('[CRLV Extractor] ❌ GEMINI_API_KEY não configurada no .env');
    return null;
  }

  const base64Data = buffer.toString('base64');
  const prompt = `
Você é um especialista em extração de dados de CRLV e CRLV-e de veículos brasileiros.
Analise a imagem ou documento PDF anexo e extraia com precisão máxima:
- placa: Placa do veículo (apenas letras e números em maiúsculo).
- renavam: Código RENAVAM completo (apenas números).
- chassi: Chassi completo (17 dígitos alfanuméricos).
- uf: Sigla do Estado/UF onde o veículo está emplacado ou registrado (ex: PE, SP, RJ, BA, PR, etc. - exatamente 2 letras maiúsculas).
- cpfCnpjProprietario: CPF ou CNPJ do proprietário cadastrado (apenas números).
- nomeProprietario: Nome completo ou razão social do proprietário.
- marcaModelo: Marca e modelo descritos no documento.
- anoFabricacao: Ano de fabricação.
- anoModelo: Ano do modelo.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem crases de markdown (\`\`\`json), sem textos explicativos adicionais:
{
  "placa": "string ou null",
  "renavam": "string ou null",
  "chassi": "string ou null",
  "uf": "string ou null",
  "cpfCnpjProprietario": "string ou null",
  "nomeProprietario": "string ou null",
  "marcaModelo": "string ou null",
  "anoFabricacao": "string ou null",
  "anoModelo": "string ou null"
}
`;

  const MODELO = 'gemini-3.6-flash';

  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const response = await ai.models.generateContent({
        model: MODELO,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      const rawText = response.text || '';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const dados = JSON.parse(cleanJson) as DadosCRLVExtraidos;

      if (dados.placa) dados.placa = dados.placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (dados.renavam) dados.renavam = dados.renavam.trim().replace(/[^0-9]/g, '');
      if (dados.chassi) dados.chassi = dados.chassi.trim().toUpperCase();
      if (dados.uf) dados.uf = dados.uf.trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);

      return dados;
    } catch (error: any) {
      console.warn(`[CRLV Extractor] Tentativa ${tentativa} no modelo ${MODELO} oscilou: ${error.message}`);
      if (tentativa < 3) await delay(2000);
    }
  }

  console.error('[CRLV Extractor] ❌ Todas as tentativas falharam.');
  return null;
}