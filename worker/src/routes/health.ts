import { Hono } from 'hono';
import type { Env } from '../lib/env';

export const healthRoute = new Hono<{ Bindings: Env }>()
  .get('/health', (c) => c.json({ ok: true, service: 'psfpredict-api' }));
