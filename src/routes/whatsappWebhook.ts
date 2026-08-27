import { FastifyPluginAsync } from "fastify";

interface WebhookQuery {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
}

const whatsappWebhook: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Querystring: WebhookQuery }>(
    "/webhook",
    async (request, reply) => {
      const mode = request.query["hub.mode"];
      const verifyToken = request.query["hub.verify_token"];
      const challenge = request.query["hub.challenge"];

      const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

      if (
        mode === "subscribe" &&
        verifyToken &&
        expectedToken &&
        verifyToken === expectedToken &&
        challenge
      ) {
        return reply.code(200).type("text/plain").send(challenge);
      }

      return reply.code(403).send("Forbidden");
    }
  );

  fastify.post<{ Body: unknown }>(
    "/webhook",
    async (request, reply) => {
      fastify.log.info(
        { payload: request.body },
        "Webhook recebido do WhatsApp"
      );

      return reply.code(200).send({ status: "EVENT_RECEIVED" });
    }
  );
};

export default whatsappWebhook;
