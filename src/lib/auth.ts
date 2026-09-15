import { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from './prisma';

export interface DecodedToken {
  dealerId: string;
  iat: number;
  exp: number;
}

export interface AuthenticatedRequest extends FastifyRequest {
  dealerId?: string;
  dealer?: any;
  isAttendant?: boolean;
}

export async function validateDealerExists(dealerId: string) {
  if (!dealerId || !isUUID(dealerId)) {
    throw new Error('ID do dealer inválido');
  }

  const dealer = await prisma.dealer.findUnique({
    where: { id: dealerId },
  });

  if (!dealer) {
    throw new Error('Dealer não encontrado');
  }

  return dealer;
}

export function isUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

export async function validateBearerToken(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return reply.status(401).send({
        sucesso: false,
        mensagem: 'Token não fornecido',
      });
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return reply.status(401).send({
        sucesso: false,
        mensagem: 'Formato de token inválido',
      });
    }

    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));

    if (!decoded.dealerId) {
      return reply.status(401).send({
        sucesso: false,
        mensagem: 'Token inválido',
      });
    }

    const dealer = await validateDealerExists(decoded.dealerId);

    (request as AuthenticatedRequest).dealerId = decoded.dealerId;
    (request as AuthenticatedRequest).dealer = dealer;
  } catch (error: any) {
    return reply.status(401).send({
      sucesso: false,
      mensagem: 'Erro ao validar token',
      detalhe: error.message,
    });
  }
}

export async function validateAttendantAccess(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  await validateBearerToken(request, reply);

  const attendantSecret = process.env.ATTENDANT_SECRET_TOKEN;

  if (!attendantSecret) {
    console.warn('⚠️ ATTENDANT_SECRET_TOKEN não configurado');
    return reply.status(403).send({
      sucesso: false,
      mensagem: 'Acesso de atendente não configurado',
    });
  }

  const authHeader = request.headers.authorization;
  const token = authHeader?.replace('Bearer ', '') || '';

  if (token !== attendantSecret) {
    return reply.status(403).send({
      sucesso: false,
      mensagem: 'Acesso de atendente não autorizado',
    });
  }

  (request as AuthenticatedRequest).isAttendant = true;
}

export function gerarTokenDealer(dealerId: string): string {
  const token = JSON.stringify({
    dealerId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  });

  return Buffer.from(token).toString('base64');
}

export function gerarTokenAtendente(): string {
  return process.env.ATTENDANT_SECRET_TOKEN || 'attendant_token_123456';
}
