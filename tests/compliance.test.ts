import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { providerChain, registeredProviderIds } from '@/lib/ai';

/**
 * Compliance guard.
 *
 * These are not style checks — they are the V1 hard rules expressed as tests so
 * a future change cannot quietly reintroduce a prohibited integration. See
 * COMPLIANCE.md for the rules themselves.
 */

const ROOT = resolve(__dirname, '..');
const SRC = join(ROOT, 'src');

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (CODE_EXTENSIONS.has(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

/** Strips line and block comments so prose explaining a ban is not a violation. */
function stripComments(code: string): string {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
}

const FILES = sourceFiles(SRC).filter((f) => !f.includes('.test.'));

const EXECUTABLE = FILES.map((file) => ({
  file: file.slice(ROOT.length + 1).replace(/\\/g, '/'),
  code: stripComments(readFileSync(file, 'utf8')),
}));

/**
 * An external destination in the UI.
 *
 * A URL scheme only counts when it opens a string literal or an href, so an
 * identifier that happens to end in those letters is not mistaken for a link.
 * Bare host names are matched anywhere.
 */
const EXTERNAL_LINK =
  /href=\{?["'`]https?:|["'`](?:https?:|mailto:|tel:)|wa\.me|whatsapp/i;

/** Hostnames and API surfaces V1 must never contact. */
const BANNED_ENDPOINTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /googleapis\.com/i, label: 'any googleapis.com endpoint' },
  { pattern: /google\.com\/maps\/api/i, label: 'Google Maps API' },
  { pattern: /mybusiness/i, label: 'Google Business Profile API' },
  { pattern: /places\.google/i, label: 'Google Places API' },
  { pattern: /accounts\.google/i, label: 'Google account / OAuth' },
  { pattern: /aistudio\.google/i, label: 'Google AI Studio' },
  { pattern: /generativelanguage/i, label: 'Gemini generative language API' },
  { pattern: /graph\.facebook\.com/i, label: 'Meta Graph API' },
  { pattern: /api\.whatsapp\.com|graph\.whatsapp/i, label: 'WhatsApp API' },
  { pattern: /\bimap\b/i, label: 'IMAP' },
  { pattern: /smtp\./i, label: 'SMTP' },
  { pattern: /nodemailer/i, label: 'email sending' },
];

describe('V1 hard rules — prohibited integrations', () => {
  it('contacts no Google endpoint anywhere in the runtime', () => {
    const violations: string[] = [];
    for (const { file, code } of EXECUTABLE) {
      for (const { pattern, label } of BANNED_ENDPOINTS) {
        if (pattern.test(code)) violations.push(`${file}: ${label}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('registers no Google-operated AI provider', () => {
    expect(registeredProviderIds()).toEqual(['groq']);
    expect(registeredProviderIds()).not.toContain('gemini');
  });

  it('ignores a stale Gemini setting instead of contacting it', () => {
    const previous = process.env.REPOS_AI_FALLBACK;
    const previousKey = process.env.GEMINI_API_KEY;
    try {
      process.env.REPOS_AI_FALLBACK = 'gemini';
      process.env.GEMINI_API_KEY = 'pretend-key';
      // An unknown provider id must resolve to nothing, not to a guess.
      expect(providerChain().map((p) => p.id)).not.toContain('gemini');
    } finally {
      if (previous === undefined) delete process.env.REPOS_AI_FALLBACK;
      else process.env.REPOS_AI_FALLBACK = previous;
      if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = previousKey;
    }
  });

  it('makes outbound network calls only from the AI provider adapters', () => {
    const callers = EXECUTABLE.filter(({ code }) =>
      /\bfetch\s*\(|XMLHttpRequest|axios|got\(|node-fetch/.test(code),
    ).map(({ file }) => file);

    expect(callers.sort()).toEqual(['src/lib/ai/groq.ts']);
  });
});

describe('V1 hard rules — no secrets reach the browser', () => {
  it('defines no NEXT_PUBLIC_ variable anywhere', () => {
    const offenders = EXECUTABLE.filter(({ code }) =>
      code.includes('NEXT_PUBLIC_'),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('reads process.env only in server-side modules', () => {
    const offenders = FILES.filter((file) => {
      const raw = readFileSync(file, 'utf8');
      const isClient = /^['"]use client['"]/m.test(raw);
      return isClient && /process\.env/.test(stripComments(raw));
    }).map((f) => f.slice(ROOT.length + 1).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});

describe('V1 hard rules — no automatic external fetching or posting', () => {
  it('schedules no timers or cron-style background fetching', () => {
    const offenders = EXECUTABLE.filter(({ code }) =>
      /setInterval\s*\(|node-cron|node-schedule/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('stores platform links as plain strings without any client library', () => {
    const packageJson = JSON.parse(
      readFileSync(join(ROOT, 'package.json'), 'utf8'),
    ) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };

    const allDeps = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });

    const banned = allDeps.filter((dep) =>
      /google|gapi|firebase|facebook|whatsapp|twilio|nodemailer|imap|sendgrid/i.test(
        dep,
      ),
    );
    expect(banned).toEqual([]);
  });
});

describe('V1 hard rules — suggested replies go nowhere on their own (M7)', () => {
  const REPLY_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/reply/') ||
      file === 'src/lib/feedback/replies.ts' ||
      file === 'src/lib/actions/replies.ts' ||
      file === 'src/lib/ai/draft-reply.ts' ||
      file === 'src/components/forms/reply-panel.tsx',
  );

  it('has a reply layer to guard', () => {
    expect(REPLY_FILES.length).toBeGreaterThan(4);
  });

  it('never builds a wa.me or any messaging deep link', () => {
    const offenders = EXECUTABLE.filter(({ code }) =>
      /wa\.me|whatsapp:|api\.whatsapp|sms:|mailto:|tg:\/\//i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('makes no outbound call from the reply layer except the drafting adapter', () => {
    const offenders = REPLY_FILES.filter(
      ({ file, code }) =>
        file !== 'src/lib/ai/draft-reply.ts' && /fetch\s*\(|axios|got\s*\(/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('exposes no send, post or publish action', () => {
    const offenders = EXECUTABLE.filter(({ code }) =>
      /export\s+async\s+function\s+\w*(?:send|post|publish|submitReply)\w*Action/i.test(
        code,
      ),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('keeps the review-incentive ban in code, not just in the documentation', async () => {
    const { checkDraft } = await import('@/lib/reply/safety');
    const { resolveVoice } = await import('@/lib/reply/voice');
    const { getPackOrFallback } = await import('@/lib/packs');

    const voice = resolveVoice(
      getPackOrFallback('clinic'),
      { businessName: 'Test Clinic', vertical: 'clinic' },
      null,
      null,
    );

    for (const attempt of [
      'Thanks! Please leave us a 5 star review.',
      'Sorry about that — update your review and we will give you a discount.',
      'If you remove your review we can help you further.',
    ]) {
      const result = checkDraft(attempt, {
        voice,
        sourceText: 'some review',
        allowedContext: [],
      });
      expect(result.storable, attempt).toBe(false);
    }
  });
});

describe('V1 hard rules — owner communication is prepared, never sent (M8)', () => {
  const COMMS_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/comms/') ||
      file === 'src/components/forms/owner-comms.tsx',
  );

  it('has a communication layer to guard', () => {
    expect(COMMS_FILES.length).toBeGreaterThan(2);
  });

  it('makes no outbound call of any kind', () => {
    const offenders = COMMS_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|got\s*\(|XMLHttpRequest|WebSocket/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('talks to no AI provider — owner updates are fully deterministic', () => {
    const offenders = COMMS_FILES.filter(({ code }) =>
      /runCompletion|draftReplyWithAi|classifyReviews|@\/lib\/ai/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('schedules nothing and queues nothing', () => {
    const offenders = COMMS_FILES.filter(({ code }) =>
      /setInterval|setTimeout|cron|queue|worker|notification/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('exposes no send action for owner messages', () => {
    const offenders = EXECUTABLE.filter(({ code }) =>
      /export\s+async\s+function\s+\w*(?:sendOwner|sendUpdate|notifyOwner|emailOwner|whatsappOwner)\w*/i.test(
        code,
      ),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('refuses a review incentive in an owner-facing message too', async () => {
    const { checkDraft } = await import('@/lib/reply/safety');
    const { resolveVoice } = await import('@/lib/reply/voice');
    const { getPackOrFallback } = await import('@/lib/packs');

    const voice = resolveVoice(
      getPackOrFallback('salon'),
      { businessName: 'Test Salon', vertical: 'salon' },
      null,
      null,
    );

    for (const attempt of [
      'Tell your happy customers they get 10% off for a 5 star review.',
      'Offer a free blow-dry to anyone who updates their review.',
      'Give a discount to customers who remove their bad review.',
    ]) {
      const result = checkDraft(attempt, {
        voice,
        sourceText: '',
        allowedContext: [],
        allowedNumbers: new Set(['10', '5']),
        maxWords: 320,
      });
      expect(result.storable, attempt).toBe(false);
    }
  });

  it('refuses a statistic the stored data does not support', async () => {
    const { checkDraft } = await import('@/lib/reply/safety');
    const { resolveVoice } = await import('@/lib/reply/voice');
    const { getPackOrFallback } = await import('@/lib/packs');

    const voice = resolveVoice(
      getPackOrFallback('clinic'),
      { businessName: 'Test Clinic', vertical: 'clinic' },
      null,
      null,
    );

    const result = checkDraft('Complaints dropped 37 percent this period.', {
      voice,
      sourceText: '',
      allowedContext: [],
      allowedNumbers: new Set(['9', '50']),
      maxWords: 320,
    });
    expect(result.storable).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('invented_number');
  });
});

describe('V1 hard rules — the command centre only reads what is stored (M9)', () => {
  const COMMAND_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/command/') ||
      file === 'src/components/command-card.tsx' ||
      file === 'src/app/(app)/page.tsx',
  );

  it('has a command centre to guard', () => {
    expect(COMMAND_FILES.length).toBeGreaterThan(2);
  });

  it('makes no outbound call of any kind', () => {
    const offenders = COMMAND_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|got\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('talks to no AI provider — priority is deterministic', () => {
    const offenders = COMMAND_FILES.filter(({ code }) =>
      /runCompletion|draftReplyWithAi|classifyReviews|@\/lib\/ai\//.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('schedules nothing, polls nothing and refreshes nothing on a timer', () => {
    const offenders = COMMAND_FILES.filter(({ code }) =>
      /setInterval|setTimeout|cron|revalidate\s*:\s*\d|refetchInterval/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('measures nothing about the operator', () => {
    const offenders = COMMAND_FILES.filter(({ code }) =>
      /analytics|telemetry|gtag|posthog|mixpanel|segment\.|track\s*\(/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('links only inside RepOS — no external destination anywhere on the board', () => {
    const offenders = COMMAND_FILES.filter(({ code }) =>
      EXTERNAL_LINK.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('adds no dependency at all', () => {
    const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
      dependencies: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    const all = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    });

    // Anything needing an account, a key or a subscription is out by rule; this
    // asserts the whole list is still the small local set M1 started with.
    const external =
      /google|gapi|firebase|facebook|whatsapp|twilio|nodemailer|imap|sendgrid|sentry|datadog|posthog|mixpanel|segment|amplitude|stripe|auth0|clerk|supabase|vercel-kv|redis|bullmq|agenda|node-cron/i;
    expect(all.filter((dep) => external.test(dep))).toEqual([]);
  });

  it('offers no action RepOS cannot actually perform', async () => {
    const { nextActionFor } = await import('@/lib/command/priority');

    const base = {
      clientId: 'c1',
      businessName: 'Test',
      status: 'HEALTHY' as const,
      topSignalDetail: null,
      trendDeclining: false,
      topIssue: null,
      actions: { awaitingDecision: 0, readyToMeasure: 0 },
      lastFollowUpAt: null,
      daysSinceLastSnapshot: 10,
      snapshotCount: 1,
      lastActivityAt: new Date('2026-03-01T00:00:00.000Z'),
      ownerUpdateReady: false,
      now: new Date('2026-03-16T00:00:00.000Z'),
    };

    const variants = [
      { total: 0, unread: 0, needsYou: 0, awaitingDraft: 0, draftsReady: 0 },
      { total: 9, unread: 9, needsYou: 0, awaitingDraft: 0, draftsReady: 0 },
      { total: 9, unread: 0, needsYou: 2, awaitingDraft: 0, draftsReady: 0 },
      { total: 9, unread: 0, needsYou: 0, awaitingDraft: 3, draftsReady: 0 },
      { total: 9, unread: 0, needsYou: 0, awaitingDraft: 0, draftsReady: 3 },
    ];

    // Routes the app really serves. A next action pointing anywhere else would
    // be a dead end for the operator.
    const routes = [
      /^\/clients\/c1$/,
      /^\/clients\/c1\/feedback(\?|$)/,
      /^\/clients\/c1\/minutes$/,
      /^\/clients\/c1\/snapshots\/new$/,
      /^\/clients\/c1#owner-update$/,
      /^\/clients\/c1#actions$/,
    ];

    for (const feedback of variants) {
      for (const ownerUpdateReady of [false, true]) {
        const action = nextActionFor({ ...base, feedback, ownerUpdateReady });
        expect(
          routes.some((route) => route.test(action.href)),
          `${action.key} -> ${action.href}`,
        ).toBe(true);
      }
    }
  });
});

describe('V1 hard rules — customer intelligence is deterministic and local (M10)', () => {
  const INTELLIGENCE_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/intelligence/') ||
      file === 'src/components/intelligence-panel.tsx',
  );

  it('has an intelligence layer to guard', () => {
    expect(INTELLIGENCE_FILES.length).toBeGreaterThan(2);
  });

  it('makes no outbound call of any kind', () => {
    const offenders = INTELLIGENCE_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|got\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('reaches no AI provider: every insight is application code', () => {
    const offenders = INTELLIGENCE_FILES.filter(({ code }) =>
      /runCompletion|draftReplyWithAi|classifyReviews|@\/lib\/ai\b|@\/lib\/ai\//.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('schedules nothing and refreshes nothing on a timer', () => {
    const offenders = INTELLIGENCE_FILES.filter(({ code }) =>
      /setInterval|setTimeout|cron|revalidate\s*:\s*\d|refetchInterval/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('measures nothing about the operator', () => {
    const offenders = INTELLIGENCE_FILES.filter(({ code }) =>
      /analytics|telemetry|gtag|posthog|mixpanel|segment\.|track\s*\(/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('links only inside RepOS', () => {
    const offenders = INTELLIGENCE_FILES.filter(({ code }) =>
      EXTERNAL_LINK.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('stores nothing: intelligence is derived from rows on every read', () => {
    const offenders = INTELLIGENCE_FILES.filter(({ code }) =>
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('works with no AI configured at all', async () => {
    const { buildIntelligence } = await import('@/lib/intelligence/engine');
    const { getPackOrFallback } = await import('@/lib/packs');

    const intel = buildIntelligence({
      client: { id: 'c1', businessName: 'Test Clinic', vertical: 'clinic' },
      pack: getPackOrFallback('clinic'),
      themes: {
        praises: [
          {
            key: 'doctor_care',
            label: "Doctor's care",
            kind: 'PRAISE',
            severity: 'low',
            count: 8,
            itemIds: Array.from({ length: 8 }, (_, i) => `p${i}`),
          },
        ],
        issues: [
          {
            key: 'wait_time',
            label: 'Long waiting time',
            kind: 'ISSUE',
            severity: 'high',
            count: 6,
            itemIds: Array.from({ length: 6 }, (_, i) => `i${i}`),
          },
        ],
        analysedCount: 30,
      },
      totalFeedback: 30,
      pulse: {
        available: false,
        reason: 'Two snapshots are needed before periods can be compared.',
        direction: 'NONE',
        directionLabel: 'Not enough data',
        current: null,
        previous: null,
        periodDays: null,
        metrics: [],
        notableChanges: [],
        sampleWarning: null,
      },
      notes: [],
    });

    // A full verdict, with no provider involved anywhere.
    expect(intel.attention?.themeKey).toBe('wait_time');
    expect(intel.loved.length).toBe(1);
    expect(intel.headline.length).toBe(2);
  });

  it('states no number it cannot show the evidence for', async () => {
    const { buildIntelligence, intelligenceNumbers } = await import(
      '@/lib/intelligence/engine'
    );
    const { getPackOrFallback } = await import('@/lib/packs');

    const intel = buildIntelligence({
      client: { id: 'c1', businessName: 'Test Clinic', vertical: 'clinic' },
      pack: getPackOrFallback('clinic'),
      themes: {
        praises: [],
        issues: [
          {
            key: 'wait_time',
            label: 'Long waiting time',
            kind: 'ISSUE',
            severity: 'high',
            count: 6,
            itemIds: Array.from({ length: 6 }, (_, i) => `i${i}`),
          },
        ],
        analysedCount: 30,
      },
      totalFeedback: 30,
      pulse: {
        available: false,
        reason: 'Two snapshots are needed before periods can be compared.',
        direction: 'NONE',
        directionLabel: 'Not enough data',
        current: null,
        previous: null,
        periodDays: null,
        metrics: [],
        notableChanges: [],
        sampleWarning: null,
      },
      notes: [],
    });

    const allowed = intelligenceNumbers(intel);
    // Threshold wording is allowed to name its own floors.
    for (const floor of ['1', '2', '3', '10', '25']) allowed.add(floor);

    const prose = [
      intel.evidence.note,
      intel.headlineNote,
      intel.overallTrendNote,
      ...intel.limits,
      ...intel.headline.flatMap((insight) => [
        insight.headline,
        insight.detail,
        insight.confidenceReason,
        insight.movement.note,
        ...insight.signals.map((signal) => signal.reason),
      ]),
    ].join(' ');

    for (const figure of prose.match(/\d+(?:\.\d+)?/g) ?? []) {
      expect(allowed.has(figure), `${figure} is not backed by stored data`).toBe(true);
    }
  });
});

describe('V1 hard rules — the action loop is human-driven and evidence-bound (M11)', () => {
  const IMPROVE_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/improve/') ||
      file === 'src/lib/actions/improve.ts' ||
      file === 'src/components/forms/improvement-actions.tsx',
  );

  it('has an action loop to guard', () => {
    expect(IMPROVE_FILES.length).toBeGreaterThan(3);
  });

  it('makes no outbound call of any kind', () => {
    const offenders = IMPROVE_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|got\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never asks a model whether a change worked', () => {
    const offenders = IMPROVE_FILES.filter(({ code }) =>
      /runCompletion|draftReplyWithAi|classifyReviews|@\/lib\/ai\b|@\/lib\/ai\//.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('schedules nothing, polls nothing and queues no reminder', () => {
    // The word "reminder" is allowed in prose; a mechanism that fires one is
    // not. This looks for the mechanism.
    const offenders = IMPROVE_FILES.filter(({ code }) =>
      /setInterval|setTimeout|cron|revalidate\s*:\s*\d|refetchInterval|Notification|serviceWorker|webpush/i.test(
        code,
      ),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('measures nothing about the operator', () => {
    const offenders = IMPROVE_FILES.filter(({ code }) =>
      /analytics|telemetry|gtag|posthog|mixpanel|segment\.|track\s*\(/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('links only inside RepOS', () => {
    const offenders = IMPROVE_FILES.filter(({ code }) => EXTERNAL_LINK.test(code)).map(
      ({ file }) => file,
    );
    expect(offenders).toEqual([]);
  });

  it('brings in no new feedback of its own — the operator pastes it in', () => {
    const offenders = EXECUTABLE.filter(
      ({ file }) => file.startsWith('src/lib/improve/'),
    )
      .filter(({ code }) => /reviewItem\.(create|createMany|upsert|update)/.test(code))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never claims a change caused anything, in any wording it produces', async () => {
    const { measureAction } = await import('@/lib/improve/measure');
    const { getPackOrFallback } = await import('@/lib/packs');
    const pack = getPackOrFallback('clinic');

    const themed = (id: string, at: string, mentions: boolean) => ({
      id,
      analysisStatus: 'ANALYSED',
      evidenceAt: new Date(at),
      themesJson: mentions
        ? JSON.stringify([
            {
              key: 'wait_time',
              label: 'Long waiting time',
              kind: 'ISSUE',
              sentiment: 'NEGATIVE',
              severity: 'high',
            },
          ])
        : '[]',
    });

    const baseline = {
      count: 9,
      total: 50,
      itemIds: [],
      confidence: 'STRONG' as const,
      capturedAt: new Date('2026-03-01T00:00:00.000Z'),
      snapshotId: null,
      snapshotLabel: null,
    };

    // Every outcome the engine can reach.
    const shapes = [30, 12, 6, 2, 0];
    for (const withTheme of shapes) {
      const rows = Array.from({ length: 30 }, (_, i) =>
        themed(`r${i}`, '2026-05-01T00:00:00.000Z', i < withTheme),
      );
      const measurement = measureAction({
        pack,
        themeKey: 'wait_time',
        themeLabel: 'Long waiting time',
        sentiment: 'ISSUE',
        baseline,
        doneAt: new Date('2026-04-01T00:00:00.000Z'),
        rows,
        now: new Date('2026-06-01T00:00:00.000Z'),
      });

      const claims = [measurement.headline, measurement.resultLabel, ...measurement.why].join(
        ' ',
      );
      expect(claims).not.toMatch(
        /\bcaused\b|\bproved\b|\bproves\b|because of (the|your) change|thanks to|as a result of/i,
      );
      // ...and it says out loud that it cannot show causation.
      expect(measurement.limits.join(' ')).toMatch(/cannot show that the change caused/i);
      // No promise, no incentive, no medical claim.
      expect(claims).not.toMatch(
        /guarantee|five.star|discount|refund|compensat|cure|diagnos|treatment will/i,
      );
    }
  });

  it('invents no workflow state RepOS does not record', async () => {
    const { ACTION_STATUSES, TRANSITIONS, STATUS_LABELS, STATUS_MEANINGS } = await import(
      '@/lib/improve/model'
    );
    expect(ACTION_STATUSES.length).toBe(6);
    const serialised = JSON.stringify({
      ACTION_STATUSES,
      TRANSITIONS,
      STATUS_LABELS,
      STATUS_MEANINGS,
    });
    expect(serialised).not.toMatch(
      /assigned|snoozed|overdue|escalated|waiting.for.client|due.date|reminder/i,
    );
  });

  it('says in the state itself that "done" is not proof of anything', async () => {
    const { STATUS_MEANINGS } = await import('@/lib/improve/model');
    expect(STATUS_MEANINGS.DONE).toMatch(/not evidence that it worked/i);
  });
});
