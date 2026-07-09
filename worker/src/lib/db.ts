import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../../drizzle/schema';
import type { Env } from './env';

export type Db = ReturnType<typeof createDb>;
export type Database = Db;

export function createDb(env: Env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to use the PostgreSQL store.');
  }

  return drizzle(neon(env.DATABASE_URL), { schema });
}
