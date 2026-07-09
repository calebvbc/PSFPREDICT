import { Hono } from 'hono';
import { savePredictionsSchema, usernameSchema } from '../../../shared/validators/prediction';
import type { Env } from '../lib/env';
import { createDb } from '../lib/db';
import { createRepository } from '../lib/repository';
import { assertSaveRateLimit, memoryRateLimitStore } from '../lib/rate-limit';

function getClientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export const predictionsRoute = new Hono<{ Bindings: Env }>()
  .get('/participants/:username', async (c) => {
    const db = createDb(c.env);
    const repo = createRepository(db);

    const parsed = usernameSchema.safeParse(c.req.param('username'));
    if (!parsed.success) return c.json({ error: 'Username inválido.' }, 400);

    return c.json({ participant: await repo.getParticipantByUsername(parsed.data) });
  })
  .get('/matches/:matchExternalId/predictions', async (c) => {
    const db = createDb(c.env);
    const repo = createRepository(db);

    const result = await repo.getPublicPredictionsForMatch(c.req.param('matchExternalId'));
    if (!result.ok) return c.json({ error: result.error, predictions: [] }, 403);

    return c.json({ predictions: result.predictions });
  })
  .post('/predictions', async (c) => {
    const rateLimit = await assertSaveRateLimit(memoryRateLimitStore, getClientIp(c.req.raw));
    if (rateLimit.limited) {
      c.header('Retry-After', String(rateLimit.retryAfterSeconds));
      return c.json({ error: `Aguarde ${rateLimit.retryAfterSeconds}s antes de salvar novamente.` }, 429);
    }

    const db = createDb(c.env);
    const repo = createRepository(db);

    const parsed = savePredictionsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'Dados inválidos.', issues: parsed.error.flatten() }, 400);
    }

    for (const prediction of parsed.data.predictions) {
      const windowValidation = await repo.validatePredictionWindow(prediction.matchExternalId);
      if (!windowValidation.ok) {
        return c.json({ error: windowValidation.error, matchExternalId: prediction.matchExternalId }, 409);
      }
    }

    const participant = await repo.upsertParticipantPredictions(parsed.data);
    return c.json({ ok: true, participant });
  });
