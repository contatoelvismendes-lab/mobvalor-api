import 'dotenv/config';
import Fastify from 'fastify';
import whatsappWebhook from './routes/whatsappWebhook';
import { renaveRoutes } from './routes/renaveRoutes';

const server = Fastify({
  logger: true,
});

// Registro de rotas
server.register(whatsappWebhook);
server.register(renaveRoutes);

server.get('/health', async () => {
  return { status: 'ok' };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3000);
    await server.listen({
      port,
      host: '0.0.0.0',
    });
    console.log(`Servidor rodando na porta ${port}`);
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();