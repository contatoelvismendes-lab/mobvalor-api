import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { PacoteService } from '../services/pacoteService';
import { prisma } from '../lib/prisma';

describe('PacoteService', () => {
  const pacoteMock = {
    id: 'pacote-123',
    nome: 'Pacote Premium',
    descricao: 'Pacote com 100 consultas',
    preco: 199.99,
    consultas: 100,
    duracao: 30,
    ativo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let pacoteId: string;

  beforeAll(async () => {
    vi.spyOn(prisma.pacote, 'findMany').mockResolvedValue([]);
  });

  afterAll(async () => {
    vi.restoreAllMocks();
  });

  describe('criarPacote', () => {
    it('deve criar um novo pacote com dados válidos', async () => {
      const pacoteEsperado = {
        id: '123',
        ...pacoteMock,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.pacote, 'create').mockResolvedValueOnce(pacoteEsperado);

      const resultado = await PacoteService.criarPacote(pacoteMock);

      expect(resultado).toEqual(pacoteEsperado);
      expect(resultado.nome).toBe(pacoteMock.nome);
      expect(resultado.preco).toBe(pacoteMock.preco);

      pacoteId = resultado.id;
    });

    it('deve rejeitar pacote com preço negativo', () => {
      const pacoteInvalido = {
        ...pacoteMock,
        preco: -10,
      };

      expect(async () => {
        await PacoteService.criarPacote(pacoteInvalido);
      }).rejects.toThrow();
    });
  });

  describe('listarPacotes', () => {
    it('deve listar todos os pacotes', async () => {
      const pacotes = [
        {
          id: '1',
          ...pacoteMock,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(prisma.pacote, 'findMany').mockResolvedValueOnce(pacotes);

      const resultado = await PacoteService.listarPacotes();

      expect(resultado).toHaveLength(1);
      expect(resultado[0].nome).toBe(pacoteMock.nome);
    });

    it('deve listar apenas pacotes ativos quando filtro é true', async () => {
      const pacotesAtivos = [
        {
          id: '1',
          ...pacoteMock,
          ativo: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      vi.spyOn(prisma.pacote, 'findMany').mockResolvedValueOnce(pacotesAtivos);

      const resultado = await PacoteService.listarPacotes(true);

      expect(resultado).toHaveLength(1);
      expect(resultado[0].ativo).toBe(true);
    });
  });

  describe('obterPacote', () => {
    it('deve retornar um pacote pelo ID', async () => {
      const pacote = {
        id: '123',
        ...pacoteMock,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.pacote, 'findUnique').mockResolvedValueOnce(pacote);

      const resultado = await PacoteService.obterPacote('123');

      expect(resultado).toEqual(pacote);
      expect(resultado.id).toBe('123');
    });

    it('deve lançar erro quando pacote não é encontrado', async () => {
      vi.spyOn(prisma.pacote, 'findUnique').mockResolvedValueOnce(null);

      expect(async () => {
        await PacoteService.obterPacote('inexistente');
      }).rejects.toThrow('Pacote não encontrado');
    });
  });

  describe('atualizarPacote', () => {
    it('deve atualizar um pacote existente', async () => {
      const pacoteAtualizado = {
        id: '123',
        ...pacoteMock,
        preco: 249.99,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.pacote, 'findUnique').mockResolvedValueOnce({
        id: '123',
        ...pacoteMock,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      vi.spyOn(prisma.pacote, 'update').mockResolvedValueOnce(pacoteAtualizado);

      const resultado = await PacoteService.atualizarPacote('123', { preco: 249.99 });

      expect(resultado.preco).toBe(249.99);
    });
  });

  describe('deletarPacote', () => {
    it('deve deletar um pacote existente', async () => {
      const pacote = {
        id: '123',
        ...pacoteMock,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(prisma.pacote, 'findUnique').mockResolvedValueOnce(pacote);
      vi.spyOn(prisma.pacote, 'delete').mockResolvedValueOnce(pacote);

      const resultado = await PacoteService.deletarPacote('123');

      expect(resultado.id).toBe('123');
    });
  });

  describe('ativarPacote', () => {
    it('deve ativar um pacote', async () => {
      const pacote = {
        id: '123',
        ...pacoteMock,
        ativo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pacoteAtivado = {
        ...pacote,
        ativo: true,
      };

      vi.spyOn(prisma.pacote, 'findUnique').mockResolvedValueOnce(pacote);
      vi.spyOn(prisma.pacote, 'update').mockResolvedValueOnce(pacoteAtivado);

      const resultado = await PacoteService.ativarPacote('123');

      expect(resultado.ativo).toBe(true);
    });
  });

  describe('desativarPacote', () => {
    it('deve desativar um pacote', async () => {
      const pacote = {
        id: '123',
        ...pacoteMock,
        ativo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const pacoteDesativado = {
        ...pacote,
        ativo: false,
      };

      vi.spyOn(prisma.pacote, 'findUnique').mockResolvedValueOnce(pacote);
      vi.spyOn(prisma.pacote, 'update').mockResolvedValueOnce(pacoteDesativado);

      const resultado = await PacoteService.desativarPacote('123');

      expect(resultado.ativo).toBe(false);
    });
  });
});
