import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DadosDocumentoVeiculo {
  placa: string | null;
  renavam: string | null;
  chassi: string | null;
  uf: string | null;
  marcaModelo: string | null;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cpfCnpjProprietario: string | null;
  nomeProprietario: string | null;
}

export async function extrairDadosDocumento(
  imageBase64: string,
  mimeType: string = 'image/jpeg'
): Promise<DadosDocumentoVeiculo> {
  const prompt = `Você é um motor OCR especializado em documentos veiculares brasileiros (CRLV-e, CRV e CNH).
Analise o documento e extraia os campos com fidelidade total aos caracteres originais.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      prompt,
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          placa: { type: Type.STRING, nullable: true },
          renavam: { type: Type.STRING, nullable: true },
          chassi: { type: Type.STRING, nullable: true },
          uf: { type: Type.STRING, nullable: true },
          marcaModelo: { type: Type.STRING, nullable: true },
          anoFabricacao: { type: Type.INTEGER, nullable: true },
          anoModelo: { type: Type.INTEGER, nullable: true },
          cpfCnpjProprietario: { type: Type.STRING, nullable: true },
          nomeProprietario: { type: Type.STRING, nullable: true },
        },
      },
    },
  });

  const rawJson = response.text;
  if (!rawJson) {
    throw new Error('Falha ao extrair texto da imagem pelo Gemini.');
  }

  return JSON.parse(rawJson) as DadosDocumentoVeiculo;
}