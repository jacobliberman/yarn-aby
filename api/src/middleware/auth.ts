import type { FastifyInstance } from 'fastify';
import { verifyToken } from '@clerk/backend';

export function registerClerkAuth(app: FastifyInstance) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      'CLERK_SECRET_KEY is required. Add it to .env (see .env.example).',
    );
  }

  app.addHook('onRequest', async (request, reply) => {
    if (request.method === 'OPTIONS') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      const payload = await verifyToken(token, { secretKey });
      const sub = payload.sub;
      if (typeof sub !== 'string' || !sub) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }
      request.userId = sub;
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
}
