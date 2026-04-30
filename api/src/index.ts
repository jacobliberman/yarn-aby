import 'dotenv/config';

import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);

async function main() {
  const app = await buildApp();
  await app.listen({ port, host: '0.0.0.0' });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
