import assert from 'node:assert/strict';
import test from 'node:test';
import { parseEspnScoreboard } from './parser';

function payloadWithStatus(statusType: Record<string, unknown>) {
  return {
    events: [
      {
        id: '760509',
        date: '2026-07-07T16:00Z',
        name: 'Egypt at Argentina',
        shortName: 'EGY @ ARG',
        competitions: [
          {
            date: '2026-07-07T16:00Z',
            status: { type: statusType },
            competitors: [
              {
                id: '202',
                homeAway: 'home',
                score: '0',
                winner: false,
                team: { id: '202', displayName: 'Argentina' },
              },
              {
                id: '2620',
                homeAway: 'away',
                score: '0',
                winner: false,
                team: { id: '2620', displayName: 'Egypt' },
              },
            ],
          },
        ],
      },
    ],
  };
}

test('parses ESPN scheduled status from structured fields', () => {
  const [match] = parseEspnScoreboard(payloadWithStatus({ id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false }));

  assert.equal(match.status, 'scheduled');
});

test('parses ESPN live status from structured fields', () => {
  const [match] = parseEspnScoreboard(payloadWithStatus({ id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false }));

  assert.equal(match.status, 'in_progress');
});

test('parses ESPN halftime status as in progress', () => {
  const [match] = parseEspnScoreboard(payloadWithStatus({ id: '2', name: 'STATUS_HALFTIME', state: 'in', completed: false }));

  assert.equal(match.status, 'in_progress');
});

test('parses ESPN final status from completed flag', () => {
  const [match] = parseEspnScoreboard(payloadWithStatus({ id: '3', name: 'STATUS_FINAL', state: 'post', completed: true }));

  assert.equal(match.status, 'final');
});

test('maps unknown ESPN status to a safe prediction-blocking status', () => {
  const [match] = parseEspnScoreboard(payloadWithStatus({ id: '999', name: 'STATUS_DELAYED_UNKNOWN', state: 'mystery', completed: false }));

  assert.equal(match.status, 'in_progress');
});
