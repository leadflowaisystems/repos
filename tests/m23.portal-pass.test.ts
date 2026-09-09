import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TRIAL_DAYS,
  TRIAL_DEFAULT_DAYS_SETTING,
  continuationStatus,
  describeAccount,
  getAccountState,
  getTrialDefaultDays,
  listContinuationRequests,
  normaliseTrialDays,
  pauseService,
  requestContinuation,
  resumeService,
  saveTrialDefaultDays,
  startTrial,
  updateOwnerContact,
} from '@/lib/commercial/service';
import { completeOnboarding } from '@/lib/onboarding/service';
import { createClient } from '@/lib/clients/service';
import { getBoard } from '@/lib/command/board';
import { nextActionFor, prioritySignals } from '@/lib/command/priority';
import { toActionRecord } from '@/lib/improve/service';
import { MESSAGES } from '@/lib/i18n/strings';
import { createTestDb, resetDb, validClientInput } from './helpers/test-db';

/**
 * THE CLIENT PORTAL PASS (M23).
 *
 * What an owner is told about their account, and what the operator receives
 * when they act on it. Four claims, each one a sentence an owner reads or a
 * button they press:
 *
 *   1. A trial has an end date, always. New businesses get one at creation
 *      (30 days unless the operator changes the default -- 14 when this pass
 *      first shipped; see M27) and no owner-facing
 *      page ever says a trial is open-ended, or talks about "what this costs".
 *   2. When the trial ends the workspace and its history stay, and the one
 *      thing offered is to continue — which captures a name, an email and a
 *      mobile number, creates a request the operator can see and act on, and
 *      creates nothing else: no amount, no invoice, no card.
 *   3. A paused account is said to be paused, calmly, with nothing deleted and
 *      the date it was paused; a resumed one says it resumed.
 *   4. The owner still cannot see the negotiated amount or the operator's note,
 *      and nothing the pass added lets them.
 *
 * The database claims run against a real PostgreSQL schema. The wording claims
 * run against the source, because that is where the words live and the
 * components are server components with no renderer in this suite.
 */

let db: PrismaClient;
const NOW = new Date('2026-09-07T10:00:00.000Z');
const DAY = 86_400_000;

beforeAll(async () => {
  db = createTestDb('m23-portal-pass');
}, 180_000);

afterAll(async () => {
  await db?.$disconnect();
});

beforeEach(async () => {
  await resetDb(db);
});

async function makeClient(overrides: Record<string, unknown> = {}): Promise<string> {
  const client = await db.client.create({
    data: {
      businessName: 'Corner Cafe',
      vertical: 'restaurant',
      status: 'ACTIVE',
      ...overrides,
    },
    select: { id: true },
  });
  return client.id;
}

async function makeOwner(email = 'owner@corner.test'): Promise<string> {
  const user = await db.user.create({ data: { email }, select: { id: true } });
  return user.id;
}

// ---------------------------------------------------------------------------
// 1. Every trial has an end date
// ---------------------------------------------------------------------------

describe('a trial has an end date, always', () => {
  it('starts every self-serve business on a trial of the default length, with an explicit end', async () => {
    const userId = await makeOwner();
    const result = await completeOnboarding(
      db,
      userId,
      { businessName: 'Corner Cafe', vertical: 'restaurant' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const client = await db.client.findUniqueOrThrow({
      where: { id: result.data.clientId },
      select: { subscriptionStatus: true, trialStartsAt: true, trialEndsAt: true },
    });
    expect(client.subscriptionStatus).toBe('TRIAL');
    expect(client.trialStartsAt?.toISOString()).toBe(NOW.toISOString());
    expect(client.trialEndsAt?.toISOString()).toBe(
      new Date(NOW.getTime() + DEFAULT_TRIAL_DAYS * DAY).toISOString(),
    );
    expect(DEFAULT_TRIAL_DAYS).toBe(30);
  });

  it("starts a business added from the operator's list on the same trial", async () => {
    const result = await createClient(db, validClientInput({ businessName: 'Sunrise Clinic' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const client = await db.client.findUniqueOrThrow({
      where: { id: result.data.id },
      select: { subscriptionStatus: true, trialStartsAt: true, trialEndsAt: true },
    });
    expect(client.subscriptionStatus).toBe('TRIAL');
    expect(client.trialStartsAt).not.toBeNull();
    expect(client.trialEndsAt).not.toBeNull();
    const length = Math.round(
      (client.trialEndsAt!.getTime() - client.trialStartsAt!.getTime()) / DAY,
    );
    expect(length).toBe(DEFAULT_TRIAL_DAYS);
  });

  it('lets the operator change the default without a schema change, and validates it', async () => {
    expect(await getTrialDefaultDays(db)).toBe(30);

    const saved = await saveTrialDefaultDays(db, '21');
    expect(saved.ok).toBe(true);
    expect(await getTrialDefaultDays(db)).toBe(21);
    expect(
      (await db.appSetting.findUnique({ where: { key: TRIAL_DEFAULT_DAYS_SETTING } }))?.value,
    ).toBe('21');

    // The new default reaches a new business.
    const userId = await makeOwner();
    const result = await completeOnboarding(
      db,
      userId,
      { businessName: 'Long Trial Cafe', vertical: 'restaurant' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const client = await db.client.findUniqueOrThrow({
      where: { id: result.data.clientId },
      select: { trialEndsAt: true },
    });
    expect(client.trialEndsAt?.toISOString()).toBe(new Date(NOW.getTime() + 21 * DAY).toISOString());

    // And "Start a trial" with no length uses it too.
    const id = await makeClient();
    const started = await startTrial(db, id, undefined, { now: NOW });
    expect(started.ok && started.data.days).toBe(21);

    for (const bad of ['0', '-3', '400', '14.5', 'two weeks', '']) {
      expect((await saveTrialDefaultDays(db, bad)).ok, bad).toBe(false);
    }
    expect(normaliseTrialDays('014')).toBe(14);
    expect(normaliseTrialDays(365)).toBe(365);
    expect(normaliseTrialDays('366')).toBeNull();
  });

  it('tells the owner the date the trial runs to, never that it is open-ended', () => {
    const base = {
      trialStartsAt: NOW,
      paymentRequestedAt: null,
      ownerName: 'Priya',
      ownerEmail: 'priya@corner.test',
      ownerPhone: '9876543210',
      now: NOW,
    };
    const running = describeAccount({
      ...base,
      subscriptionStatus: 'TRIAL',
      trialEndsAt: new Date(NOW.getTime() + 14 * DAY),
    });
    expect(running.phase).toBe('TRIAL');
    expect(running.headline).toBe('Your Headway trial');
    expect(running.line).toBe('Your trial runs until 21 September 2026.');
    expect(running.trialDaysLeft).toBe(14);

    // A pre-M23 row, before the backfill: still not "no end date".
    const pending = describeAccount({ ...base, subscriptionStatus: 'TRIAL', trialEndsAt: null });
    expect(pending.phase).toBe('TRIAL');
    expect(pending.line).not.toMatch(/no end date/i);
    expect(pending.line).toMatch(/end date/);
  });
});

// ---------------------------------------------------------------------------
// 2. When the trial ends
// ---------------------------------------------------------------------------

describe('when the trial ends', () => {
  const base = {
    trialStartsAt: new Date(NOW.getTime() - 20 * DAY),
    trialEndsAt: new Date(NOW.getTime() - 2 * DAY),
    paymentRequestedAt: null,
    ownerName: 'Priya',
    ownerEmail: 'priya@corner.test',
    ownerPhone: '9876543210',
    now: NOW,
  };

  it('says the feedback and the history are safe, and offers to continue', () => {
    const ended = describeAccount({ ...base, subscriptionStatus: 'TRIAL' });
    expect(ended.phase).toBe('TRIAL_ENDED');
    expect(ended.headline).toBe('Your trial has ended');
    expect(ended.line).toBe('Your feedback and your history are safe.');
    expect(ended.trialExpired).toBe(true);
    expect(ended.line).not.toMatch(/₹|\$|price|pricing|per month|locked|expired/i);
  });

  it('captures a name, an email and a mobile number, and creates a request the operator sees', async () => {
    const id = await makeClient({
      subscriptionStatus: 'TRIAL',
      trialStartsAt: base.trialStartsAt,
      trialEndsAt: base.trialEndsAt,
    });
    const before = await db.reviewItem.count();

    const result = await requestContinuation(
      db,
      id,
      { name: 'Priya Shah', email: ' Priya@Corner.test ', phone: '+91 98765 43210' },
      { now: NOW },
    );
    expect(result.ok).toBe(true);

    const state = await getAccountState(db, id, { now: NOW });
    expect(state?.continuationRequestedAt?.toISOString()).toBe(NOW.toISOString());
    expect(state?.owner).toEqual({
      name: 'Priya Shah',
      email: 'priya@corner.test',
      phone: '+91 98765 43210',
    });

    // The operator's queue lists it as new, with the contact details and no amount yet.
    const requests = await listContinuationRequests(db);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      clientId: id,
      status: 'NEW',
      owner: { name: 'Priya Shah', email: 'priya@corner.test', phone: '+91 98765 43210' },
      amountInr: null,
    });

    // And the board puts it first, with the one next action.
    const board = await getBoard(db, NOW);
    const card = board.cards.find((c) => c.clientId === id);
    expect(card?.continuation).toEqual({ status: 'NEW', requestedOn: '07 Sept 2026' });
    expect(card?.nextAction.key).toBe('SEND_PAYMENT_DETAILS');
    expect(card?.nextAction.href).toBe(`/clients/${id}#commercial`);
    expect(card?.band).toBe('NOW');
    expect(board.totals.continuationRequests).toBe(1);

    // Nothing else was created and nothing was deleted.
    expect(await db.commercial.count({ where: { clientId: id } })).toBe(0);
    expect(await db.reviewItem.count()).toBe(before);
  });

  it('refuses to guess at a missing detail', async () => {
    const id = await makeClient();
    const result = await requestContinuation(db, id, { name: 'A', email: 'nope', phone: '12' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(['email', 'name', 'phone']);
    expect((await getAccountState(db, id))?.continuationRequestedAt).toBeNull();
  });

  it('lets the owner update their details without asking again', async () => {
    const id = await makeClient({ ownerName: 'Old', ownerEmail: 'old@corner.test', ownerPhone: '9000000000' });
    const result = await updateOwnerContact(db, id, {
      name: 'Priya Shah',
      email: 'priya@corner.test',
      phone: '9876543210',
    });
    expect(result.ok).toBe(true);
    const state = await getAccountState(db, id);
    expect(state?.owner.name).toBe('Priya Shah');
    expect(state?.continuationRequestedAt).toBeNull();
  });

  it("follows the request through the operator's records: new, details sent, paid", async () => {
    const asked = NOW;
    expect(continuationStatus({ requestedAt: null, instructionsSentAt: null, paidAt: null })).toBeNull();
    expect(continuationStatus({ requestedAt: asked, instructionsSentAt: null, paidAt: null })).toBe('NEW');
    expect(
      continuationStatus({ requestedAt: asked, instructionsSentAt: new Date(asked.getTime() + DAY), paidAt: null }),
    ).toBe('DETAILS_SENT');
    expect(
      continuationStatus({
        requestedAt: asked,
        instructionsSentAt: new Date(asked.getTime() + DAY),
        paidAt: new Date(asked.getTime() + 2 * DAY),
      }),
    ).toBe('PAID');
    // Details sent for an EARLIER request do not answer a new one.
    expect(
      continuationStatus({ requestedAt: asked, instructionsSentAt: new Date(asked.getTime() - DAY), paidAt: null }),
    ).toBe('NEW');
  });

  it('ranks the request above everything and stops asking once details are sent', () => {
    const input = {
      clientId: 'c1',
      businessName: 'Corner Cafe',
      status: 'HEALTHY' as const,
      clientStatus: 'ACTIVE',
      setup: { gatewayLive: true, gatewayPaused: false, cardsOnSite: true, ownerLinkSent: true },
      topSignalDetail: null,
      trendDeclining: false,
      topIssue: null,
      feedback: { total: 40, unread: 3, needsYou: 0, awaitingDraft: 0, draftsReady: 0 },
      lastFollowUpAt: null,
      daysSinceLastSnapshot: 10,
      snapshotCount: 2,
      lastActivityAt: NOW,
      ownerUpdateReady: false,
      actions: { awaitingDecision: 0, readyToMeasure: 0 },
      now: NOW,
    };
    const fresh = {
      ...input,
      commercial: { status: 'NEW' as const, requestedOn: '07 Sept 2026', detailsSentOn: null, onTrial: true, trialEndsInDays: -2 },
    };
    expect(prioritySignals(fresh).map((s) => s.key)).toContain('continuation_requested');
    expect(nextActionFor(fresh).key).toBe('SEND_PAYMENT_DETAILS');

    const sent = {
      ...input,
      commercial: { status: 'DETAILS_SENT' as const, requestedOn: '07 Sept 2026', detailsSentOn: '08 Sept 2026', onTrial: true, trialEndsInDays: -2 },
    };
    expect(prioritySignals(sent).map((s) => s.key)).toContain('payment_awaited');
    expect(nextActionFor(sent).key).not.toBe('SEND_PAYMENT_DETAILS');

    const quiet = {
      ...input,
      commercial: { status: null, requestedOn: null, detailsSentOn: null, onTrial: true, trialEndsInDays: -1 },
    };
    expect(prioritySignals(quiet).map((s) => s.key)).toContain('trial_ended');
    expect(prioritySignals(input).map((s) => s.key)).not.toContain('trial_ended');
  });
});

// ---------------------------------------------------------------------------
// 3. Paused, and resumed
// ---------------------------------------------------------------------------

describe('a paused account', () => {
  it('is described calmly, with the date, and keeps everything', async () => {
    const id = await makeClient();
    await db.reviewItem.create({
      data: { clientId: id, source: 'REP_OS_QR', text: 'Lovely coffee.', stars: 5 },
    });
    const before = await db.reviewItem.findMany({ where: { clientId: id } });

    await pauseService(db, id, { now: NOW });
    const paused = await getAccountState(db, id, { now: NOW });
    expect(paused?.phase).toBe('PAUSED');
    expect(paused?.headline).toBe('Headway is paused');
    expect(paused?.line).toBe(
      'Your feedback and your history are safe. New feedback is still saved. Headway is not reading it yet.',
    );
    expect(paused?.servicePausedAt?.toISOString()).toBe(NOW.toISOString());
    expect(paused?.note).toBe('Paused since 7 September 2026.');
    expect(paused?.serviceResumedAt).toBeNull();

    const later = new Date(NOW.getTime() + 3 * DAY);
    await resumeService(db, id, { now: later });
    const resumed = await getAccountState(db, id, { now: later });
    expect(resumed?.phase).toBe('ACTIVE');
    expect(resumed?.headline).toBe('Headway is active');
    expect(resumed?.line).toBe('Headway is reading new feedback as it arrives.');
    expect(resumed?.note).toBe('Your account was paused. It is running again.');
    expect(resumed?.serviceResumedAt?.toISOString()).toBe(later.toISOString());
    expect(resumed?.servicePausedAt).toBeNull();

    // Three weeks on, the resume is no longer news.
    const muchLater = new Date(later.getTime() + 21 * DAY);
    expect((await getAccountState(db, id, { now: muchLater }))?.note).toBeNull();

    expect(await db.reviewItem.findMany({ where: { clientId: id } })).toEqual(before);
  });

  it('resumes onto a trial when the trial window is still open', async () => {
    const id = await makeClient();
    await startTrial(db, id, 14, { now: NOW });
    await pauseService(db, id, { now: NOW });
    await resumeService(db, id, { now: new Date(NOW.getTime() + DAY) });
    const state = await getAccountState(db, id, { now: new Date(NOW.getTime() + DAY) });
    expect(state?.phase).toBe('TRIAL');
    expect(state?.note).toBe('Your account was paused. It is running again.');
  });
});

// ---------------------------------------------------------------------------
// 4. What an owner reads, in the source
// ---------------------------------------------------------------------------

const ROOT = resolve(__dirname, '..');
const CODE = new Set(['.ts', '.tsx']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (CODE.has(extname(entry)) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const OWNER_FACING = sourceFiles(join(ROOT, 'src')).filter((file) => {
  const rel = file.slice(ROOT.length + 1).replace(/\\/g, '/');
  return (
    rel.startsWith('src/app/(workspace)/') ||
    rel.startsWith('src/app/(feedback)/') ||
    rel.startsWith('src/app/(auth)/') ||
    rel.startsWith('src/components/workspace/') ||
    rel.startsWith('src/components/portal/') ||
    rel.startsWith('src/components/feedback-gateway/') ||
    rel === 'src/components/forms/continue-form.tsx' ||
    rel === 'src/components/forms/team-forms.tsx' ||
    rel === 'src/lib/commercial/service.ts' ||
    rel === 'src/lib/portal/view.ts' ||
    rel === 'src/lib/portal/pages.ts' ||
    rel === 'src/lib/responsibility/engine.ts' ||
    rel === 'src/lib/retention/service.ts'
  );
});

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

describe('the words an owner reads', () => {
  it('has owner-facing files to check', () => {
    expect(OWNER_FACING.length).toBeGreaterThan(20);
  });

  it('never says "What this costs" or that a trial has no end date', () => {
    const BANNED = /what this costs|there is no end date|no end date set|open-ended trial/i;
    const offenders = OWNER_FACING.filter((f) => BANNED.test(stripComments(readFileSync(f, 'utf8')))).map(
      (f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'),
    );
    expect(offenders).toEqual([]);
  });

  it('offers the continuation on the Account page, and still names no price', () => {
    // M28 replaced the three-field "Continue with Headway" form on this page
    // with the ExtendAccessForm: phone required, email optional, and no name
    // field, because the person is signed in and the business is already known.
    // Its label now reads "Ask to continue" — "Extend access" was the one
    // phrase a customer would read as "my trial just got longer", and pressing
    // it only ever sends a message. What has NOT changed is the thing this test
    // was written for — there is no amount, no price and no plan anywhere an
    // owner can see.
    //
    // The localization pass moved the sentences themselves into the dictionary,
    // so the page is checked for the key it now renders and the words are
    // pinned where they now live. "Nothing is charged automatically." is said
    // as "No money is taken automatically." on this page.
    const page = stripComments(
      read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'account', 'page.tsx'),
    );
    expect(page).toContain('ExtendAccessForm');
    expect(page).toContain('account.headline');
    expect(page).toContain("t('account.continue.question')");
    expect(MESSAGES['account.continue.question'].en).toBe('Want to continue with Headway?');
    expect(page).toContain("t('account.continue.trialBody')");
    expect(MESSAGES['account.continue.trialBody'].en).toContain(
      'No money is taken automatically.',
    );
    // Nothing on the page knows the amount.
    expect(page).not.toContain('getCommercial');
    expect(page).not.toContain('amountInr');
    expect(page).not.toMatch(/paymentInstructions|note\s*[:=]/);

    const form = stripComments(read('src', 'components', 'forms', 'extend-access-form.tsx'));
    expect(form).toContain("t('common.form.continue.ask')");
    expect(MESSAGES['common.form.continue.ask'].en).toBe('Ask to continue');
    expect(form).toContain('name="phone"');
    expect(form).toContain('name="email"');
    expect(form).toContain('type="tel"');
    // Required phone, optional email, and no name asked for.
    expect(form).toContain("t('common.form.required')");
    expect(MESSAGES['common.form.required'].en).toBe('(required)');
    expect(form).toContain("t('common.form.optional')");
    expect(MESSAGES['common.form.optional'].en).toBe('(optional)');
    expect(form).not.toContain('name="ownerName"');
    expect(form).not.toMatch(/amount|₹|price|plan/i);

    const action = stripComments(read('src', 'lib', 'actions', 'continuation.ts'));
    expect(action).toContain(
      "We'll contact you about continuing your Headway service. Nothing is charged automatically.",
    );
    // The request is a message, not a transaction.
    expect(action).not.toMatch(/trialEndsAt|trialStartsAt/);
  });

  it('says paused and resumed in the words the owner is promised', () => {
    const service = stripComments(read('src', 'lib', 'commercial', 'service.ts'));
    expect(service).toContain("headline = 'Headway is paused'");
    expect(service).toContain('Your feedback and your history are safe. New feedback is still saved. Headway is not reading it yet.');
    expect(service).toContain("headline = 'Headway is active'");
    expect(service).toContain("line = 'Headway is reading new feedback as it arrives.'");
    expect(service).toContain('Your account was paused. It is running again.');
    // The banner across the workspace shell now reads from the dictionary, so
    // the key is what the layout carries and the sentence is pinned there.
    const layout = stripComments(
      read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'layout.tsx'),
    );
    expect(layout).toContain("t('errors.paused.banner')");
    expect(MESSAGES['errors.paused.banner'].en).toContain('Headway is paused.');
  });

  it('shows the operator the request, with the contact details and the status', () => {
    const panel = stripComments(read('src', 'components', 'forms', 'commercial-panel.tsx'));
    expect(panel).toContain('The owner asked to continue on');
    expect(panel).toContain("'Waiting on you'");
    expect(panel).toContain("'Details sent'");
    expect(panel).toContain("'Paid'");
    expect(panel).not.toContain('No trial end date set');
    const home = stripComments(read('src', 'app', '(app)', 'page.tsx'));
    expect(home).toContain('Owners waiting to continue with Headway');
  });

  it('keeps current signals on Home and the full method on Customers, once', () => {
    const home = stripComments(read('src', 'components', 'workspace', 'home.tsx'));
    expect(home).toContain('<SoFar soFar={view.soFar} basePath={basePath} />');
    // The counts-not-conclusions qualifier over the early mentions, now read
    // from the dictionary and said as "Counts only, not conclusions".
    expect(home).toContain("note={t('home.soFar.note')}");
    expect(MESSAGES['home.soFar.note'].en).toBe('Counts only, not conclusions');
    expect(home).toContain('<Limits limits={r.limitations} collapsed />');
    expect(home).not.toContain('Not worth your time right now');
    // The reason to come back is still on Home. The bold "Next check." run-in
    // went with the copy pass — the eyebrow above it already names the
    // check-in — so the section itself is what this holds in place.
    expect(home).toContain("eyebrow={t('home.nextCheck.title')}");
    expect(MESSAGES['home.nextCheck.title'].en).toBe('Your next check-in');
    expect(home).toContain('{r.nextUsefulCheck}');

    const customers = stripComments(read('src', 'components', 'workspace', 'analysis.tsx'));
    expect(customers).toContain('<SoFar soFar={view.soFar} basePath={basePath} explain />');
    expect(customers).toContain('<Limits limits={view.limits} />');
    expect(customers).toContain('<WorkList work={view.work} />');

    // The same methodology sentence is not written into two pages.
    const checkin = stripComments(read('src', 'components', 'workspace', 'checkin.tsx'));
    const improvements = stripComments(read('src', 'components', 'workspace', 'improvements.tsx'));
    expect(checkin).not.toContain('<Limits');
    expect(improvements).not.toContain('<Limits');
    expect(improvements).not.toContain('It cannot show that the change caused the difference.');
  });

  it('keeps the print kit to the sheets, placement, and staff guidance behind a click', () => {
    // The four assembly steps went with the generated tent: since M29 the kit
    // serves the two approved PDF masters, and each one carries its own
    // finishing line in the list. What the M23 trim decided is unchanged — the
    // page is the card, where to put it, and everything the staff need behind
    // one disclosure. See tests/m29.print-kit-masters.test.ts for the sheets.
    // The localization pass moved every one of these sentences into the
    // dictionary, so the page is checked for the keys it now renders and the
    // words are pinned where they now live: the placement line is "Put the card
    // where customers can see it." and the disclosure is labelled "Guidance for
    // your team".
    const kit = stripComments(read('src', 'app', '(workspace)', 'workspace', '[clientId]', 'kit', 'page.tsx'));
    expect(kit).toContain("t('kit.intro.title')");
    expect(MESSAGES['kit.intro.title'].en).toBe('Your feedback card');
    expect(kit).toContain("t('kit.intro.description')");
    expect(MESSAGES['kit.intro.description'].en).toContain(
      'Put the card where customers can see it.',
    );
    expect(kit).toContain('PRINT_SHEETS.map');
    expect(kit).toContain("t('kit.sheets.open')");
    expect(MESSAGES['kit.sheets.open'].en).toBe('Open to print');
    expect(kit).toContain("t('kit.staff.summary')");
    expect(MESSAGES['kit.staff.summary'].en).toBe('Guidance for your team');
    expect(kit.indexOf('<details')).toBeGreaterThan(0);
    expect(kit.indexOf("t('kit.staff.summary')")).toBeGreaterThan(kit.indexOf('<details'));
    // The neutral rule, said once. It is offered the same way whatever kind of
    // visit the customer had, which is the promise this counts.
    expect(kit.match(/t\('kit\.placement\.everyone'\)/g)?.length ?? 0).toBe(1);
    expect(MESSAGES['kit.placement.everyone'].en).toContain(
      'Offer the card to every customer, the same way, whatever kind of visit they had.',
    );
  });

  it('no longer tells a business owner that they do not sign in here', () => {
    const login = stripComments(read('src', 'app', '(auth)', 'login', 'page.tsx'));
    expect(login).not.toContain('do not sign in here');
    expect(login).toContain('Your Headway workspace');
  });
});

// ---------------------------------------------------------------------------
// 5. Frozen text and the brand
// ---------------------------------------------------------------------------

describe('frozen measurement text reads under the brand', () => {
  it('substitutes the internal name in a measurement frozen before the rename', async () => {
    const id = await makeClient();
    const internal = ['Rep', 'OS'].join('');
    const row = await db.improvementAction.create({
      data: {
        clientId: id,
        insightId: `${id}:ISSUE:service_speed`,
        themeKey: 'service_speed',
        themeLabel: 'Slow service',
        title: 'Reduce complaints about slow service',
        baselineCount: 14,
        baselineTotal: 44,
        baselineCapturedAt: NOW,
        status: 'MEASURED',
        result: 'WORSENED',
        insightDetail: `${internal} ranked this first.`,
        resultJson: JSON.stringify({
          result: 'WORSENED',
          headline: 'Customers are mentioning slow service more often since the change.',
          why: [`The share moved by 14%, past the 5% ${internal} needs before calling a direction.`],
          limits: [`It cannot show that the change caused the difference — nothing ${internal} can see would prove that.`],
          before: { count: 14, total: 44, share: 0.32, label: 'x', line: 'y', snapshotLabel: null },
          after: { count: 18, total: 39, share: 0.46, label: 'x', line: 'y', snapshotLabel: null },
        }),
      },
    });
    const record = toActionRecord(row);
    const text = JSON.stringify(record);
    expect(text).not.toContain(internal);
    expect(record.measurement?.limits[0]).toContain('nothing Headway can see');
    expect(record.provenance.insightDetail).toBe('Headway ranked this first.');
    // The stored row is untouched: history is shown under the brand, not rewritten here.
    const stored = await db.improvementAction.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.resultJson).toContain(internal);
  });
});
