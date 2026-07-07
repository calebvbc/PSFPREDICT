import type { MiddlewareHandler } from 'hono';
import type { Env } from '../lib/env';

const ADMIN_TOKEN_HEADER = 'x-admin-token';

export const adminAuth: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const configuredToken = c.env.ADMIN_TOKEN;
  const providedToken = c.req.header(ADMIN_TOKEN_HEADER);

  if (!configuredToken) {
    return c.json({ error: 'Admin token is not configured.' }, 500);
  }

  if (!providedToken || providedToken !== configuredToken) {
    return c.json({ error: 'Unauthorized.' }, 401);
  }

  await next();
};
