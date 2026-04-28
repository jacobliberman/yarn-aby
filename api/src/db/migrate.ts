import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';

import { db, pool } from './client.js';

const migrationsFolder = join(process.cwd(), 'src/db/migrations');

async function main() {
  await migrate(db, { migrationsFolder });
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
