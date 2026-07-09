import { describe, expect, it } from 'vitest';
import { expandEspnDateQueries, getEspnDateQueries } from './espn';

describe('expandEspnDateQueries', () => {
  it('expands ESPN date ranges into individual daily scoreboard requests', () => {
    expect(expandEspnDateQueries('20260628-20260702')).toEqual([
      '20260628',
      '20260629',
      '20260630',
      '20260701',
      '20260702',
    ]);
  });

  it('keeps a single ESPN date unchanged', () => {
    expect(expandEspnDateQueries('20260709')).toEqual(['20260709']);
  });
});

describe('getEspnDateQueries', () => {
  it('keeps the original range before daily fallback queries', () => {
    expect(getEspnDateQueries('20260628-20260630')).toEqual([
      '20260628-20260630',
      '20260628',
      '20260629',
      '20260630',
    ]);
  });
});
