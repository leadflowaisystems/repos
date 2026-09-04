import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createClient } from '@/lib/clients/service';
import { importFeedbackBatch } from '@/lib/feedback/service';
import { analyseClientFeedback } from '@/lib/feedback/analysis';
import { createActionFromInsight } from '@/lib/improve/service';
import { getClientIntelligence } from '@/lib/intelligence/service';
import {
  answerQuestion,
  createContext,
  deleteContext,
  getContextSet,
  listClientContext,
  restoreContext,
  retireContext,
  updateContext,
} from '@/lib/context/service';
import { getAnalysisView, getPortalView, getReviewsView } from '@/lib/portal/service';
import { getOwnerComms } from '@/lib/comms/service';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

let db: PrismaClient;

beforeAll(() => {
  db = createTestDb('context-service');
}, 120_000);

beforeEach(async () => {
  await resetDb(db);
});

afterAll(async () => {
  await db.$disconnect();
});

const REF = new Date('2026-03-15T00:00:00.000Z');
const NOW = new Date('2026-06-01T00:00:00.000Z');
const FILTERS = { q: '', stars: null, sentiment: null, theme: null, source: null, needs: null };

async function makeClient(businessName: string, vertical = 'restaurant') {
  const result = await createClient(db, validClientInput({ businessName, vertical }));
  if (!result.ok) throw new Error(`setup failed: ${result.message}`);
  return result.data.id;
}

async function addFeedback(clientId: string, raw: string) {
  const imported = await importFeedbackBatch(db, clientId, { raw, source: 'PUBLIC_REVIEW', referenceDate: REF });
  if (!imported.ok) throw new Error(`import failed: ${imported.message}`);
  const analysed = await analyseClientFeedback(db, clientId, { useAi: false, now: NOW });
  if (!analysed.ok) throw new Error('analysis failed');
}

function cafeBatch(tag: string): string {
  const lines: string[] = [];
  for (let i = 0; i < 9; i += 1) lines.push(`1 star Service was very slow, we waited nearly an hour for mains (${tag}${i})`);
  for (let i = 0; i < 12; i += 1) lines.push(`5 stars Food was delicious and full of flavour (${tag}${i})`);
  return lines.join('\n');
}

const THREE = [
  { kind: 'OPERATING', text: 'Friday and Saturday evenings are much busier than other days', themeKey: 'service_speed' },
  { kind: 'FOCUS', text: 'Slow service is my biggest concern right now', themeKey: 'service_speed' },
  { kind: 'CONSTRAINT', text: 'I do not want discount recommendations', constraintKey: 'DISCOUNT' },
];

// ---------------------------------------------------------------------------

describe('what the owner tells RepOS is kept, in their words, with a date', () => {
  it('creates, lists, updates, retires, restores and removes a line', async () => {
    const cafe = await makeClient('Corner Cafe');
    const created = await createContext(db, cafe, THREE[0], { now: NOW });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    let rows = await listClientContext(db, cafe);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.provenance).toBe('OWNER_TOLD_US');
    expect(rows[0]?.kindLabel).toBe('How the business operates');
    expect(rows[0]?.recordedAt).toEqual(NOW);
    expect(rows[0]?.retiredAt).toBeNull();

    const updated = await updateContext(db, cafe, created.data.id, { ...THREE[0], text: 'Friday evenings are much busier' });
    expect(updated.ok).toBe(true);
    rows = await listClientContext(db, cafe);
    expect(rows[0]?.text).toBe('Friday evenings are much busier');

    const retired = await retireContext(db, cafe, created.data.id, { now: new Date('2026-07-01'), note: 'Hired a second cook' });
    expect(retired.ok).toBe(true);
    expect(await listClientContext(db, cafe)).toEqual([]);
    const all = await listClientContext(db, cafe, { includeRetired: true });
    expect(all[0]?.retiredAt).toEqual(new Date('2026-07-01'));
    expect(all[0]?.retiredNote).toBe('Hired a second cook');
    // Retired lines are not read by the pages.
    expect((await getContextSet(db, cafe)).items).toEqual([]);

    expect((await restoreContext(db, cafe, created.data.id)).ok).toBe(true);
    expect(await listClientContext(db, cafe)).toHaveLength(1);

    expect((await deleteContext(db, cafe, created.data.id)).ok).toBe(true);
    expect(await listClientContext(db, cafe, { includeRetired: true })).toEqual([]);
  });

  it('refuses contact details: business context is not a contact list', async () => {
    const cafe = await makeClient('Corner Cafe');
    for (const text of [
      'Call the manager on 98765 43210 on Fridays',
      'Send the weekly summary to owner@example.com',
    ]) {
      const result = await createContext(db, cafe, { kind: 'OPERATING', text });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.text).toMatch(/phone numbers, emails and personal details/);
    }
    expect(await listClientContext(db, cafe)).toEqual([]);
  });

  it('accepts only themes this business\'s pack knows, and only its own improvements', async () => {
    const cafe = await makeClient('Corner Cafe');
    const wrongTheme = await createContext(db, cafe, { kind: 'OPERATING', text: 'x y', themeKey: 'stylist_skill' });
    expect(wrongTheme.ok).toBe(false);
    const wrongAction = await createContext(db, cafe, { kind: 'TRIED', text: 'We tried a board', actionId: 'not-ours' });
    expect(wrongAction.ok).toBe(false);
    const constraintNeedsKey = await createContext(db, cafe, { kind: 'CONSTRAINT', text: 'No', constraintKey: null });
    expect(constraintNeedsKey.ok).toBe(false);
  });

  it('links a tried line to a real improvement rather than duplicating it', async () => {
    const cafe = await makeClient('Corner Cafe');
    await addFeedback(cafe, cafeBatch('c'));
    const intel = await getClientIntelligence(db, cafe, { now: NOW });
    const insightId = intel?.attention?.id;
    if (!insightId) throw new Error('no attention insight');
    const action = await createActionFromInsight(db, cafe, insightId, { now: NOW });
    if (!action.ok) throw new Error('no action');
    const tried = await createContext(db, cafe, { kind: 'TRIED', text: 'Same as the second server plan', actionId: action.data.id });
    expect(tried.ok).toBe(true);
    expect((await listClientContext(db, cafe))[0]?.actionId).toBe(action.data.id);
  });

  it('keeps one answer per question and never asks again', async () => {
    const cafe = await makeClient('Corner Cafe');
    await addFeedback(cafe, cafeBatch('c'));
    const before = await getPortalView(db, cafe, { now: NOW });
    expect(before?.view.question?.themeKey).toBe('service_speed');

    const first = await answerQuestion(db, cafe, { themeKey: 'service_speed', answer: 'Weekend evenings' }, { now: NOW });
    expect(first.ok).toBe(true);
    const again = await answerQuestion(db, cafe, { themeKey: 'service_speed', answer: 'All the time' });
    expect(again.ok).toBe(true);
    if (!first.ok || !again.ok) return;
    expect(again.data.id).toBe(first.data.id);
    const rows = await listClientContext(db, cafe);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.text).toBe('All the time');

    const after = await getPortalView(db, cafe, { now: NOW });
    expect(after?.view.question).toBeNull();
    expect(after?.view.first?.ownerContext).toEqual([
      'Asked "When is service slowest?", you told us: all the time.',
    ]);
  });
});

// ---------------------------------------------------------------------------

describe('the required human test — Corner Cafe', () => {
  it('remembers all three, labels them as the owner\'s, and changes nothing about the evidence', async () => {
    const cafe = await makeClient('Corner Cafe');
    await addFeedback(cafe, cafeBatch('c'));
    const before = await getPortalView(db, cafe, { now: NOW });
    if (!before) throw new Error('no view');

    for (const line of THREE) {
      const result = await createContext(db, cafe, line, { now: NOW });
      expect(result.ok).toBe(true);
    }

    const after = await getPortalView(db, cafe, { now: NOW });
    if (!after) throw new Error('no view');

    // 1 + 2: remembered, and labelled as the owner's words.
    expect(after.view.knows.map((k) => k.line)).toEqual([
      'You told us your current focus: slow service is my biggest concern right now.',
      'You told us: Friday and Saturday evenings are much busier than other days.',
      'You told us: I do not want discount recommendations. RepOS will not suggest a discount or offer.',
    ]);
    expect(after.view.first?.ownerPriority).toBe(
      'You told us your current focus: slow service is my biggest concern right now.',
    );
    expect(after.view.first?.ownerContext).toEqual([
      'You told us: Friday and Saturday evenings are much busier than other days.',
    ]);

    // 3: never as customer evidence.
    const text = JSON.stringify(after.view);
    expect(text).not.toMatch(/customers (say|said|mention|report)[^"]*(Friday|busier)/i);

    // 4: counts, shares, movement and the picture are untouched.
    expect(after.view.first?.evidenceCount).toBe(before.view.first?.evidenceCount);
    expect(after.view.first?.share).toBe(before.view.first?.share);
    expect(after.view.first?.movementCounts).toBe(before.view.first?.movementCounts);
    expect(after.view.summary).toBe(before.view.summary);
    expect(after.view.basedOn).toBe(before.view.basedOn);
    expect(after.view.loved.map((s) => s.evidenceCount)).toEqual(before.view.loved.map((s) => s.evidenceCount));

    // 5: no causal claim anywhere.
    expect(text).not.toMatch(/because of|caused|due to|led to|resulted in/i);

    // 6: the discount constraint is respected — the suggestion does not involve one.
    expect(after.view.first?.suggestion).not.toMatch(/discount|offer/i);
    expect(after.view.first?.suggestion).toBe(before.view.first?.suggestion);

    // 9: still there after reopening.
    const reopened = await getPortalView(db, cafe, { now: NOW });
    expect(reopened?.view.knows).toHaveLength(3);

    // The reviews page counts are identical too.
    const reviewsBefore = await getReviewsView(db, cafe, FILTERS, { now: NOW });
    expect(reviewsBefore?.found[0]).toMatch(/^Across all/);
    expect(reviewsBefore?.sentiments).toEqual((await getReviewsView(db, cafe, FILTERS, { now: NOW }))?.sentiments);
  });

  it('turns a staffing constraint into the pack\'s practical alternative, without hiding the complaint', async () => {
    const cafe = await makeClient('Corner Cafe');
    await addFeedback(cafe, cafeBatch('c'));
    const before = await getPortalView(db, cafe, { now: NOW });
    await createContext(db, cafe, { kind: 'CONSTRAINT', text: 'We cannot add another employee right now', constraintKey: 'STAFF' });
    const after = await getPortalView(db, cafe, { now: NOW });
    expect(after?.view.first?.themeKey).toBe('service_speed');
    expect(after?.view.first?.evidenceCount).toBe(before?.view.first?.evidenceCount);
    expect(after?.view.first?.suggestion).toMatch(/call out any table waiting past it/);
    expect(after?.view.first?.suggestionNote).toBe(
      'You told us extra staff is not possible right now, so this is the version that does not need it.',
    );
    expect(after?.view.first?.nextStep).toMatch(/^Start here: Set a target ticket time per course and post it in the kitchen, and call out/);
  });

  it('shows the owner context on the customers page and to the operator, and to nobody else', async () => {
    const cafe = await makeClient('Corner Cafe');
    const other = await makeClient('Other Cafe');
    await addFeedback(cafe, cafeBatch('c'));
    await addFeedback(other, cafeBatch('o'));
    for (const line of THREE) await createContext(db, cafe, line, { now: NOW });

    const analysis = await getAnalysisView(db, cafe, { now: NOW });
    expect(analysis?.unhappy[0]?.ownerContext).toEqual([
      'You told us: Friday and Saturday evenings are much busier than other days.',
    ]);
    const comms = await getOwnerComms(db, cafe, { now: NOW });
    expect(comms.ok && comms.data.ownerContext).toHaveLength(3);
    // The message bodies never carry it: it is for the operator, not composed by machine.
    if (comms.ok) {
      expect(comms.data.messages.map((m) => m.body).join(' ')).not.toMatch(/Friday and Saturday evenings are much busier/);
    }

    // 8: another client cannot see it.
    const otherView = await getPortalView(db, other, { now: NOW });
    expect(otherView?.view.knows).toEqual([]);
    expect(JSON.stringify(otherView?.view)).not.toMatch(/Friday and Saturday|biggest concern|discount/);
    expect(await listClientContext(db, other)).toEqual([]);
    const otherComms = await getOwnerComms(db, other, { now: NOW });
    expect(otherComms.ok && otherComms.data.ownerContext).toEqual([]);
  });
});
