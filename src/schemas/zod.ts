import { z } from 'zod';

export const pacoteSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(100),
  descricao: z.string().optional(),
  preco: z.number().positive('Preço deve ser positivo'),
  consultas: z.number().int().positive('Consultas deve ser positivo'),
  duracao: z.number().int().positive('Duração deve ser positivo'),
  ativo: z.boolean().default(true),
});

export const criarPacoteSchema = pacoteSchema;

export const atualizarPacoteSchema = pacoteSchema.partial().extend({
  id: z.string().uuid('ID deve ser um UUID válido'),
});

export const consultaSchema = z.object({
  dealerId: z.string().uuid('ID do dealer deve ser um UUID válido'),
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  placa: z.string().min(3, 'Placa deve ter pelo menos 3 caracteres').max(10),
  resultado: z.string().optional(),
  status: z.enum(['PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'ERRO']).default('PENDENTE'),
  custo: z.number().nonnegative('Custo não pode ser negativo').default(0),
});

export const criarConsultaSchema = consultaSchema;

export const atualizarConsultaSchema = consultaSchema.partial().extend({
  id: z.string().uuid('ID deve ser um UUID válido'),
});

export const transacaoSchema = z.object({
  dealerId: z.string().uuid('ID do dealer deve ser um UUID válido'),
  tipo: z.enum(['CREDITO', 'DEBITO', 'REEMBOLSO', 'AJUSTE']),
  valor: z.number().positive('Valor deve ser positivo'),
  status: z.enum(['PENDENTE', 'PROCESSANDO', 'CONCLUIDA', 'CANCELADA']).default('PENDENTE'),
  descricao: z.string().optional(),
});

export const criarTransacaoSchema = transacaoSchema;

export const atualizarTransacaoSchema = transacaoSchema.partial().extend({
  id: z.string().uuid('ID deve ser um UUID válido'),
});

export type Pacote = z.infer<typeof pacoteSchema>;
export type CriarPacote = z.infer<typeof criarPacoteSchema>;
export type AtualizarPacote = z.infer<typeof atualizarPacoteSchema>;

export type Consulta = z.infer<typeof consultaSchema>;
export type CriarConsulta = z.infer<typeof criarConsultaSchema>;
export type AtualizarConsulta = z.infer<typeof atualizarConsultaSchema>;

export type Transacao = z.infer<typeof transacaoSchema>;
export type CriarTransacao = z.infer<typeof criarTransacaoSchema>;
export type AtualizarTransacao = z.infer<typeof atualizarTransacaoSchema>;

export const consultaCompletaSchema = z.object({
  dealerId: z.string().uuid('ID do dealer deve ser um UUID válido'),
  placa: z.string().min(3, 'Placa deve ter pelo menos 3 caracteres').max(10),
  custo: z.number().default(47.90),
  status: z.enum(['EM_ANALISE', 'CONCLUIDA', 'ENTREGUE']).default('EM_ANALISE'),
});

export const criarConsultaCompletaSchema = consultaCompletaSchema.omit({ status: true });

export const entregarConsultaCompletaSchema = z.object({
  id: z.string().uuid('ID deve ser um UUID válido'),
  linkAnycar: z.string().url('Link Anycar deve ser uma URL válida'),
  pdfUrl: z.string().url('URL do PDF deve ser válida').optional(),
});

export const recargaSchema = z.object({
  dealerId: z.string().uuid('ID do dealer deve ser um UUID válido'),
  valor: z.number().positive('Valor deve ser positivo'),
  formaPagamento: z.enum(['PIX', 'CARTAO']),
});

export const criarRecargaSchema = recargaSchema;

export type ConsultaCompleta = z.infer<typeof consultaCompletaSchema>;
export type CriarConsultaCompleta = z.infer<typeof criarConsultaCompletaSchema>;
export type EntregarConsultaCompleta = z.infer<typeof entregarConsultaCompletaSchema>;

export type Recarga = z.infer<typeof recargaSchema>;
export type CriarRecarga = z.infer<typeof criarRecargaSchema>;
