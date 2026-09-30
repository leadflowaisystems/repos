import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MESSAGES } from '@/lib/i18n/strings';
import { EN, translatorFor } from '@/lib/i18n/translator';
import {
  FIRST_READING_AT,
  readinessCopy,
  readinessOf,
  usableResponses,
} from './readiness';

/**
 * THE FIRST-READING LINE (insufficient-data pass).
 *
 * Below five usable responses every portal page that shows a reading shows
 * the shared readiness card instead. These tests pin the three things that
 * decide what an owner reads: where the line is, what counts toward it, and
 * the words at each step — and then check that every page actually asks.
 */

describe('where the line is', () => {
  it('is five responses', () => {
    expect(FIRST_READING_AT).toBe(5);
  });

  it('says NONE at zero, BUILDING from one to four, READY from five', () => {
    expect(readinessOf(0).state).toBe('NONE');
    for (const n of [1, 2, 3, 4]) expect(readinessOf(n).state).toBe('BUILDING');
    for (const n of [5, 6, 40, 500]) expect(readinessOf(n).state).toBe('READY');
  });

  it('counts down to the line and stops at zero', () => {
    expect(readinessOf(0).remaining).toBe(5);
    expect(readinessOf(2).remaining).toBe(3);
    expect(readinessOf(4).remaining).toBe(1);
    expect(readinessOf(5).remaining).toBe(0);
    expect(readinessOf(9).remaining).toBe(0);
  });

  it('is "almost there" at four, and only at four', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((n) => readinessOf(n).almost)).toEqual([
      false,
      false,
      false,
      false,
      true,
      false,
      false,
    ]);
  });

  it('never goes negative or fractional on a bad count', () => {
    expect(readinessOf(-3)).toMatchObject({ state: 'NONE', count: 0 });
    expect(readinessOf(Number.NaN)).toMatchObject({ state: 'NONE', count: 0 });
    expect(readinessOf(3.9)).toMatchObject({ state: 'BUILDING', count: 3 });
  });
});

describe('what counts toward it', () => {
  it('counts every response, including ones still being read', () => {
    expect(usableResponses({ total: 4, failed: 0 })).toBe(4);
  });

  it('leaves out a response Headway failed to read', () => {
    // Five arrived, one could not be read: four can contribute, so the pages
    // must still say "almost there" rather than open onto an empty reading.
    const r = readinessOf(usableResponses({ total: 5, failed: 1 }));
    expect(r).toMatchObject({ state: 'BUILDING', count: 4, almost: true });
  });
});

describe('what the owner is told', () => {
  it('at zero: explains how feedback arrives, with the whole way to go', () => {
    const copy = readinessCopy(readinessOf(0), EN);
    expect(copy?.title).toBe('Waiting for your first feedback');
    expect(copy?.body).toMatch(/QR card or feedback link/);
    expect(copy?.progress).toBe('0 / 5 responses');
    expect(copy?.remaining).toBe('5 more responses to go');
  });

  it('at one: singular, and still building', () => {
    const copy = readinessCopy(readinessOf(1), EN);
    expect(copy?.title).toBe('Your insights are still building');
    expect(copy?.body).toMatch(/^You've received 1 response so far\./);
    expect(copy?.progress).toBe('1 / 5 responses');
    expect(copy?.remaining).toBe('4 more responses to go');
  });

  it('at two: the real count, and three to go', () => {
    const copy = readinessCopy(readinessOf(2), EN);
    expect(copy?.title).toBe('Your insights are still building');
    expect(copy?.body).toBe(
      "You've received 2 responses so far. Headway needs a little more customer feedback before it can show meaningful patterns and trends.",
    );
    expect(copy?.progress).toBe('2 / 5 responses');
    expect(copy?.remaining).toBe('3 more responses to go');
  });

  it('at four: almost there, naming the line', () => {
    const copy = readinessCopy(readinessOf(4), EN);
    expect(copy?.title).toBe('Almost there');
    expect(copy?.body).toBe(
      "You've received 4 responses. Headway will start showing your strongest customer patterns and trends once you reach 5 responses.",
    );
    expect(copy?.remaining).toBe('1 more response to go');
  });

  it('at five and above: nothing — the page renders as it always did', () => {
    expect(readinessCopy(readinessOf(5), EN)).toBeNull();
    expect(readinessCopy(readinessOf(120), EN)).toBeNull();
  });

  it('never apologises and never calls it an error', () => {
    for (const n of [0, 1, 2, 3, 4]) {
      const copy = readinessCopy(readinessOf(n), EN);
      const all = Object.values(copy ?? {}).join(' ').toLowerCase();
      expect(all).not.toMatch(/sorry|unfortunately|error|failed|broken|no data/);
    }
  });

  it('keeps the numbers identical in Hindi and Marathi', () => {
    for (const locale of ['hi', 'mr'] as const) {
      const t = translatorFor(locale);
      const copy = readinessCopy(readinessOf(2), t);
      expect(copy?.body).toContain('2');
      expect(copy?.progress).toContain('2 / 5');
      expect(copy?.remaining).toContain('3');
      expect(copy?.title).not.toBe(readinessCopy(readinessOf(2), EN)?.title);
    }
  });

  it('has every phrase in all three languages', () => {
    const keys = Object.keys(MESSAGES).filter((k) => k.startsWith('readiness.'));
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      const phrase = MESSAGES[key as keyof typeof MESSAGES];
      expect(phrase.hi, `${key} has no Hindi`).toBeTruthy();
      expect(phrase.mr, `${key} has no Marathi`).toBeTruthy();
    }
  });
});

describe('every page that shows a reading asks first', () => {
  // A page that forgot to ask would show a trend off three responses while
  // the page beside it says "almost there". Source-level, so it fails the
  // moment a surface stops consulting the one shared answer.
  const ROOT = resolve(__dirname, '..', '..', '..');
  const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

  const SURFACES: Array<[string, string]> = [
    ['Home', 'src/components/workspace/home.tsx'],
    ['Customers', 'src/components/workspace/analysis.tsx'],
    ['Check-in', 'src/components/workspace/checkin.tsx'],
    ['Improvements', 'src/components/workspace/improvements.tsx'],
    ['This week', 'src/app/(workspace)/workspace/[clientId]/pulse/page.tsx'],
    ['This month', 'src/app/(workspace)/workspace/[clientId]/review/page.tsx'],
  ];

  for (const [name, file] of SURFACES) {
    it(`${name} consults the shared readiness`, () => {
      expect(read(file)).toMatch(/\b(getReadiness|readinessOf)\(/);
    });
  }

  it('renders the one shared card, never its own copy of the words', () => {
    for (const file of [
      'src/components/workspace/brief.tsx',
      'src/components/workspace/analysis.tsx',
      'src/components/workspace/checkin.tsx',
      'src/components/workspace/improvements.tsx',
      'src/components/workspace/period-report.tsx',
    ]) {
      const src = read(file);
      expect(src, file).toContain('<InsightsBuilding');
      expect(src, file).not.toContain("'readiness.building.title'");
    }
  });
});
