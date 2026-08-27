import "dotenv/config";
import Fastify from "fastify";
import whatsappWebhook from "./routes/whatsappWebhook";

const server = Fastify({
  logger: true,
});

server.register(whatsappWebhook);

server.get("/health", async () => {
  return { status: "ok" };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3000);

    await server.listen({
      port,
      host: "0.0.0.0",
    });
  } catch (error) {
    server.log.error(error);
    process.exit(1);
  }
};

start();
