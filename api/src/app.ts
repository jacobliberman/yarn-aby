import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';

import { registerClerkAuth } from './middleware/auth.js';
import patternsRoutes from './routes/patterns.js';
import projectsRoutes from './routes/projects.js';
import yarnRoutes from './routes/yarn.js';

export type BuildAppOptions = {
  /** When set, skips Clerk and attaches this user id to every request (for tests). */
  testUserId?: string;
};

export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.testUserId ? false : true,
  });
  await app.register(cors, { origin: true });

  if (options.testUserId) {
    const testUserId = options.testUserId;
    app.addHook('onRequest', async (request) => {
      if (request.method === 'OPTIONS') {
        return;
      }
      request.userId = testUserId;
    });
  } else {
    registerClerkAuth(app);
  }

  await app.register(yarnRoutes, { prefix: '/yarn' });
  await app.register(patternsRoutes, { prefix: '/patterns' });
  await app.register(projectsRoutes, { prefix: '/projects' });

  return app;
}
