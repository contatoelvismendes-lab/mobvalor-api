import Fastify from 'fastify';
import dotenv from 'dotenv';
import { supabase } from './config/supabase';
import { whatsappWebhookRoutes } from './routes/whatsappWebhook';
import { infinitepayWebhook } from './routes/infinitepayWebhook';
import { renaveRoutes } from './routes/renaveRoutes';

dotenv.config();

const app = Fastify({ logger: true });

app.register(whatsappWebhookRoutes);
app.register(infinitepayWebhook, { prefix: '/webhook' });
app.register(renaveRoutes, { prefix: '/api/renave-on' });

// Rota de teste
app.get('/health', async (request, reply) => {
  return { 
    status: 'OK', 
    app: 'Mobvalor Backend',
    timestamp: new Date().toISOString()
  };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Servidor Mobvalor rodando em http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();