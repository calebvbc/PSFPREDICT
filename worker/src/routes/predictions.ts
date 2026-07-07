import { Hono } from 'hono';
import { savePredictionsSchema, usernameSchema } from '../../../shared/validators/prediction';
import type { Env } from '../lib/env';
import { getParticipantByUsername, getPublicPredictionsForMatch, upsertParticipantPredictions, validatePredictionWindow } from '../lib/memory-store';
import { assertSaveRateLimit } from '../lib/rate-limit';

function getClientIp(request: Request) {
  return request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
}

export const predictionsRoute = new Hono<{ Bindings: Env }>()
  .get('/participants/:username', (c) => {
    const parsed = usernameSchema.safeParse(c.req.param('username'));
    if (!parsed.success) return c.json({ error: 'Username inválido.' }, 400);

    return c.json({ participant: getParticipantByUsername(parsed.data) });
  })
  .get('/matches/:matchExternalId/predictions', (c) => {
    const result = getPublicPredictionsForMatch(c.req.param('matchExternalId'));
    if (!result.ok) return c.json({ error: result.error, predictions: [] }, 403);

    return c.json({ predictions: result.predictions });
  })
  .post('/predictions', async (c) => {
    const rateLimit = await assertSaveRateLimit(c.env.RATE_LIMIT_KV, getClientIp(c.req.raw));
    if (rateLimit.limited) {
      c.header('Retry-After', String(rateLimit.retryAfterSeconds));
      return c.json({ error: `Aguarde ${rateLimit.retryAfterSeconds}s antes de salvar novamente.` }, 429);
    }

    const parsed = savePredictionsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: 'Dados inválidos.', issues: parsed.error.flatten() }, 400);
    }

    for (const prediction of parsed.data.predictions) {
      const windowValidation = validatePredictionWindow(prediction.matchExternalId);
      if (!windowValidation.ok) {
        return c.json({ error: windowValidation.error, matchExternalId: prediction.matchExternalId }, 409);
      }
    }

    const participant = upsertParticipantPredictions(parsed.data);
    return c.json({ ok: true, participant });
  });
