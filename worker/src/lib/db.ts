import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../../../drizzle/schema';
import type { Env } from './env';

export type Database = ReturnType<typeof createDb>;

export function createDb(env: Pick<Env, 'DATABASE_URL'>) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}
