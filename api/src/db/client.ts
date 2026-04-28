import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import { getDatabaseUrl } from './databaseUrl.js';
import * as schema from './schema.js';

const { Pool } = pg;

export const pool = new Pool({ connectionString: getDatabaseUrl() });

export const db = drizzle(pool, { schema });
