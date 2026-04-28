import type { FastifyInstance } from 'fastify';

export function registerApiKeyAuth(app: FastifyInstance) {
  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      return;
    }
    const key = request.headers['x-api-key'];
    if (key !== process.env.API_KEY) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}
