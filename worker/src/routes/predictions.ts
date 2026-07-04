import { Hono } from 'hono';
import { savePredictionsSchema, usernameSchema } from '../../../shared/validators/prediction';
import type { Env } from '../lib/env';
import { assertSaveRateLimit, getParticipantByUsername, upsertParticipantPredictions } from '../lib/memory-store';

function getClientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export const predictionsRoute = new Hono<{ Bindings: Env }>()
  .get('/participants/:username', (c) => {
    const parsed = usernameSchema.safeParse(c.req.param('username'));
    if (!parsed.success) return c.json({ error: 'Username inválido.' }, 400);

    return c.json({ participant: getParticipantByUsername(parsed.data) });
  })
  .post('/predictions', async (c) => {
    const rateLimit = assertSaveRateLimit(getClientIp(c.req.raw));
    if (rateLimit.limited) {
      c.header('Retry-After', String(rateLimit.retryAfterSeconds));
      return c.json({ error: `Aguarde ${rateLimit.retryAfterSeconds}s antes de salvar novamente.` }, 429);
    }

    const parsed = savePredictionsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'Dados inválidos.', issues: parsed.error.flatten() }, 400);
    }

    const participant = upsertParticipantPredictions(parsed.data);
    return c.json({ ok: true, participant });
  });
