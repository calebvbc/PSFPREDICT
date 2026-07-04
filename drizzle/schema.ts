import { boolean, index, integer, pgEnum, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const matchRound = pgEnum('match_round', ['round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final']);
export const matchStatus = pgEnum('match_status', ['scheduled', 'in_progress', 'final']);

export const participants = pgTable('participants', {
  id: serial('id').primaryKey(),
  displayName: text('display_name').notNull(),
  username: text('username').notNull(),
  usernameNormalized: text('username_normalized').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  usernameUnique: uniqueIndex('participants_username_normalized_unique').on(table.usernameNormalized),
}));

export const matches = pgTable('matches', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull(),
  round: matchRound('round').notNull(),
  kickoffAt: timestamp('kickoff_at', { withTimezone: true }).notNull(),
  status: matchStatus('status').notNull().default('scheduled'),
  homeTeamId: text('home_team_id').notNull(),
  homeTeamName: text('home_team_name').notNull(),
  homeTeamLogoUrl: text('home_team_logo_url'),
  homeTeamColor: text('home_team_color'),
  homeTeamPlaceholder: boolean('home_team_placeholder').notNull().default(false),
  awayTeamId: text('away_team_id').notNull(),
  awayTeamName: text('away_team_name').notNull(),
  awayTeamLogoUrl: text('away_team_logo_url'),
  awayTeamColor: text('away_team_color'),
  awayTeamPlaceholder: boolean('away_team_placeholder').notNull().default(false),
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  winnerTeamId: text('winner_team_id'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  externalUnique: uniqueIndex('matches_external_id_unique').on(table.externalId),
  kickoffIdx: index('matches_kickoff_at_idx').on(table.kickoffAt),
}));

export const predictions = pgTable('predictions', {
  id: serial('id').primaryKey(),
  participantId: integer('participant_id').references(() => participants.id).notNull(),
  matchId: integer('match_id').references(() => matches.id).notNull(),
  homeScore: integer('home_score').notNull(),
  awayScore: integer('away_score').notNull(),
  points: integer('points').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  participantMatchUnique: uniqueIndex('predictions_participant_match_unique').on(table.participantId, table.matchId),
}));

export const feedEvents = pgTable('feed_events', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
