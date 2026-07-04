import { z } from 'zod';

export const usernameSchema = z.string().trim().min(1).max(20).regex(/^\S+$/, 'Username não pode conter espaços.').transform((value) => value.toLowerCase());
export const displayNameSchema = z.string().trim().min(1).max(30);
export const scoreSchema = z.coerce.number().int().min(0).max(20);

export const savePredictionsSchema = z.object({
  displayName: displayNameSchema,
  username: usernameSchema,
  predictions: z.array(z.object({
    matchExternalId: z.string().min(1),
    homeScore: scoreSchema,
    awayScore: scoreSchema,
  })).min(1),
});
