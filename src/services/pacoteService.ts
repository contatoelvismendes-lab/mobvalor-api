import { prisma } from '../lib/prisma';
import { CriarPacote, AtualizarPacote } from '../schemas/zod';

export class PacoteService {
  static async listarPacotes(ativo?: boolean) {
    return prisma.pacote.findMany({
      where: ativo !== undefined ? { ativo } : undefined,
      orderBy: { preco: 'asc' },
    });
  }

  static async obterPacote(id: string) {
    const pacote = await prisma.pacote.findUnique({
      where: { id },
    });

    if (!pacote) {
      throw new Error('Pacote não encontrado');
    }

    return pacote;
  }

  static async criarPacote(dados: CriarPacote) {
    return prisma.pacote.create({
      data: {
        nome: dados.nome,
        descricao: dados.descricao,
        preco: dados.preco,
        consultas: dados.consultas,
        duracao: dados.duracao,
        ativo: dados.ativo ?? true,
      },
    });
  }

  static async atualizarPacote(id: string, dados: Partial<CriarPacote>) {
    const pacoteExistente = await this.obterPacote(id);

    return prisma.pacote.update({
      where: { id },
      data: {
        nome: dados.nome ?? pacoteExistente.nome,
        descricao: dados.descricao ?? pacoteExistente.descricao,
        preco: dados.preco ?? pacoteExistente.preco,
        consultas: dados.consultas ?? pacoteExistente.consultas,
        duracao: dados.duracao ?? pacoteExistente.duracao,
        ativo: dados.ativo ?? pacoteExistente.ativo,
      },
    });
  }

  static async deletarPacote(id: string) {
    await this.obterPacote(id);
    return prisma.pacote.delete({ where: { id } });
  }

  static async ativarPacote(id: string) {
    return this.atualizarPacote(id, { ativo: true });
  }

  static async desativarPacote(id: string) {
    return this.atualizarPacote(id, { ativo: false });
  }
}
