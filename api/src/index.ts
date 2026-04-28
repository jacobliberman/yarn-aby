import 'dotenv/config';

import cors from '@fastify/cors';
import Fastify from 'fastify';

import { registerApiKeyAuth } from './middleware/auth.js';
import patternsRoutes from './routes/patterns.js';
import projectsRoutes from './routes/projects.js';
import yarnRoutes from './routes/yarn.js';

const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  registerApiKeyAuth(app);
  await app.register(yarnRoutes, { prefix: '/yarn' });
  await app.register(patternsRoutes, { prefix: '/patterns' });
  await app.register(projectsRoutes, { prefix: '/projects' });

  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
