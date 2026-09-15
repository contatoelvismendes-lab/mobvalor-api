import axios from 'axios';
import { prisma } from '../lib/prisma';

export class PdfService {
  static async formatarRelatorioPdfAnycar(
    linkAnycar: string,
    placa: string,
    dealerId: string
  ) {
    try {
      if (!linkAnycar) {
        throw new Error('Link Anycar é obrigatório');
      }

      const dealer = await prisma.dealer.findUnique({ where: { id: dealerId } });
      if (!dealer) {
        throw new Error('Dealer não encontrado');
      }

      console.log(`Formatando relatório para placa ${placa}`);
      console.log(`Link Anycar: ${linkAnycar}`);
      console.log(`Dealer: ${dealer.name}`);

      await this.validarLinkAnycar(linkAnycar);

      const pdfUrl = await this.gerarPdfMobvalor(linkAnycar, placa, dealer);

      return pdfUrl;
    } catch (error: any) {
      console.error('Erro ao formatar PDF:', error.message);
      throw error;
    }
  }

  private static async gerarPdfMobvalor(
    linkAnycar: string,
    placa: string,
    dealer: any
  ): Promise<string> {
    try {
      // 1. Baixar PDF da Anycar
      const pdfBuffer = await this.baixarPdfAnycar(linkAnycar);

      // 2. Extrair informações do PDF (usar pdfparse ou PDFKit)
      // Por enquanto, vamos gerar um novo PDF com as informações
      const nomeArquivo = `${placa}_${dealer.id}_${Date.now()}.pdf`;

      // 3. Armazenar em Supabase Storage
      const urlPublica = await this.salvarEmSupabase(pdfBuffer, nomeArquivo, placa);

      console.log(`✅ PDF Mobvalor gerado: ${urlPublica}`);
      return urlPublica;
    } catch (error: any) {
      console.error('Erro ao gerar PDF Mobvalor:', error.message);
      throw new Error(`Falha ao gerar PDF: ${error.message}`);
    }
  }

  private static async baixarPdfAnycar(url: string): Promise<Buffer> {
    try {
      console.log(`📥 Baixando PDF de: ${url}`);

      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
      });

      if (!response.data) {
        throw new Error('PDF vazio recebido');
      }

      console.log(`✅ PDF baixado com sucesso (${response.data.length} bytes)`);
      return Buffer.from(response.data);
    } catch (error: any) {
      console.error('Erro ao baixar PDF Anycar:', error.message);
      throw new Error(`Falha ao baixar PDF Anycar: ${error.message}`);
    }
  }

  private static async salvarEmSupabase(
    pdfBuffer: Buffer,
    nomeArquivo: string,
    placa: string
  ): Promise<string> {
    try {
      const { supabase } = await import('../config/supabase.js');

      const caminho = `consultas/${placa}/${nomeArquivo}`;

      console.log(`💾 Salvando PDF em Supabase: ${caminho}`);

      const { data, error } = await supabase.storage
        .from('mobvalor-docs')
        .upload(caminho, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (error) {
        throw new Error(`Erro Supabase: ${error.message}`);
      }

      const urlPublica = `${process.env.SUPABASE_URL}/storage/v1/object/public/mobvalor-docs/${data.path}`;

      console.log(`✅ URL pública: ${urlPublica}`);
      return urlPublica;
    } catch (error: any) {
      console.error('Erro ao salvar em Supabase:', error.message);
      throw new Error(`Falha ao salvar PDF: ${error.message}`);
    }
  }

  static async validarLinkAnycar(url: string): Promise<boolean> {
    try {
      if (!url.startsWith('http')) {
        throw new Error('Link deve começar com http');
      }

      if (!url.includes('pdf') && !url.includes('anycar')) {
        throw new Error('URL não parece ser um PDF válido');
      }

      // Validar se o link é acessível
      const response = await axios.head(url, { timeout: 10000 });

      if (response.status !== 200) {
        throw new Error(`URL retornou status ${response.status}`);
      }

      console.log(`✅ Link Anycar validado: ${url}`);
      return true;
    } catch (error: any) {
      console.error('Erro ao validar link:', error.message);
      throw new Error(`Link Anycar inválido: ${error.message}`);
    }
  }

  static async gerarPdfComIdentidadeMobvalor(
    placa: string,
    dados: any,
    dealer: any
  ): Promise<Buffer> {
    try {
      const PDFDocument = require('pdfkit');
      const doc = new PDFDocument();

      let buffers: any[] = [];
      doc.on('data', (data: any) => buffers.push(data));

      // Header Mobvalor
      doc.fontSize(20).font('Helvetica-Bold').text('MOBVALOR', 50, 50);
      doc.fontSize(10).font('Helvetica').text('Inteligência Automotiva', 50, 75);

      // Informações do Dealer
      doc.fontSize(12).font('Helvetica-Bold').text('Dealer:', 50, 110);
      doc.fontSize(10).font('Helvetica').text(dealer.name || 'N/A', 50, 130);

      // Placa
      doc.fontSize(12).font('Helvetica-Bold').text('Placa:', 50, 160);
      doc.fontSize(14).font('Helvetica-Bold').text(placa.toUpperCase(), 50, 180);

      // Dados do veículo
      doc.fontSize(12).font('Helvetica-Bold').text('Informações do Veículo:', 50, 220);
      doc.fontSize(10).font('Helvetica');

      let yPosition = 240;
      Object.entries(dados).forEach(([chave, valor]: [string, any]) => {
        doc.text(`${chave}: ${valor}`, 50, yPosition);
        yPosition += 20;
      });

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(
          `Relatório gerado em ${new Date().toLocaleString('pt-BR')} - Mobvalor © 2026`,
          50,
          750,
          { align: 'center' }
        );

      doc.end();

      return new Promise((resolve, reject) => {
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });
        doc.on('error', reject);
      });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error.message);
      throw error;
    }
  }
}
