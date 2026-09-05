import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { providerChain, registeredProviderIds } from '@/lib/ai';
import { listPacks } from '@/lib/packs';

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
    // A URI scheme only counts inside a string or an href. M18 added a field
    // named `whatsapp` holding copy-ready text, and a property name is not a
    // deep link — the thing this guards against is RepOS constructing an
    // address that opens a messaging app with a message already in it.
    const DEEP_LINK =
      /wa\.me|api\.whatsapp|href=\{?["'`](?:whatsapp|sms|mailto|tg):|["'`](?:whatsapp|sms|mailto|tg):[^"'`\s]/i;
    const offenders = EXECUTABLE.filter(({ code }) => DEEP_LINK.test(code)).map(
      ({ file }) => file,
    );
    expect(offenders).toEqual([]);
  });

  it('still catches a real messaging deep link if one is ever added', () => {
    // The guard above was loosened in M18, so prove it did not go blind.
    const DEEP_LINK =
      /wa\.me|api\.whatsapp|href=\{?["'`](?:whatsapp|sms|mailto|tg):|["'`](?:whatsapp|sms|mailto|tg):[^"'`\s]/i;
    for (const bad of [
      'const url = "https://wa.me/919000000000?text=hi";',
      'href={`whatsapp://send?text=${body}`}',
      '<a href="mailto:owner@example.com?body=hi">Send</a>',
      "const link = 'sms:+919000000000?body=hi';",
      'fetch("https://api.whatsapp.com/send")',
    ]) {
      expect(DEEP_LINK.test(bad), bad).toBe(true);
    }
    // And does not fire on an ordinary field name or a label.
    for (const fine of [
      'whatsapp: string;',
      'const c = { whatsapp: body };',
      'label="Copy for WhatsApp"',
      'email: { subject, greeting, signOff, body },',
    ]) {
      expect(DEEP_LINK.test(fine), fine).toBe(false);
    }
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

    // Anything needing an account, a key or a subscription is out by rule.
    // M20 admits exactly one exception, named here rather than by loosening
    // the pattern: Supabase, which is the database and the identity provider
    // the product now runs on. Every other name on this list stays banned,
    // including the other auth vendors - swapping Supabase for Clerk or Auth0
    // is a decision, not a dependency bump.
    const sanctioned = ['@supabase/supabase-js', '@supabase/ssr'];
    const external =
      /google|gapi|firebase|facebook|whatsapp|twilio|nodemailer|imap|sendgrid|sentry|datadog|posthog|mixpanel|segment|amplitude|stripe|auth0|clerk|supabase|vercel-kv|redis|bullmq|agenda|node-cron/i;
    expect(all.filter((dep) => external.test(dep) && !sanctioned.includes(dep))).toEqual([]);
  });

  it('offers no action RepOS cannot actually perform', async () => {
    const { nextActionFor } = await import('@/lib/command/priority');

    const base = {
      clientId: 'c1',
      businessName: 'Test',
      status: 'HEALTHY' as const,
      clientStatus: 'ACTIVE',
      setup: {
        gatewayLive: true,
        gatewayPaused: false,
        cardsOnSite: true,
        ownerLinkSent: true,
      },
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
      /^\/clients\/c1\/qr$/,
      /^\/clients\/c1\/kit$/,
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
        dimensions: [],
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
        dimensions: [],
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

describe('V1 hard rules — the client portal shows only that client (M12)', () => {
  const PORTAL_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/portal/') ||
      file.startsWith('src/components/portal/') ||
      file.startsWith('src/app/(portal)/'),
  );

  it('has a portal to guard', () => {
    expect(PORTAL_FILES.length).toBeGreaterThan(3);
  });

  it('makes no outbound call of any kind', () => {
    const offenders = PORTAL_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|got\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('reaches no AI provider: the portal only presents stored conclusions', () => {
    const offenders = PORTAL_FILES.filter(({ code }) =>
      /runCompletion|draftReplyWithAi|classifyReviews|@\/lib\/ai\b|@\/lib\/ai\//.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('writes nothing — the owner view is read-only', () => {
    const offenders = PORTAL_FILES.filter(({ code }) =>
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('builds no authentication, session or identity infrastructure', () => {
    const offenders = PORTAL_FILES.filter(({ code }) =>
      /next-auth|oauth|jwt|bcrypt|passport|session\(|signIn|createSession|setCookie/i.test(
        code,
      ),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('links only inside the portal, never to operator screens', () => {
    const offenders: string[] = [];
    for (const { file, code } of PORTAL_FILES) {
      if (EXTERNAL_LINK.test(code)) offenders.push(`${file}: external link`);
      // A link into /clients/... would drop the owner into the operator tool.
      if (/href=\{?[`'"]\/clients\//.test(code)) offenders.push(`${file}: operator link`);
      if (/href=\{?[`'"]\/minutes/.test(code)) offenders.push(`${file}: minutes link`);
    }
    expect(offenders).toEqual([]);
  });

  it('never queries without a client scope', () => {
    // Every portal read must be bounded to the one client it belongs to —
    // either by that client's id, or (M16) by the secret token, which resolves
    // to exactly one client through a unique constraint.
    const offenders: string[] = [];
    for (const { file, code } of PORTAL_FILES) {
      const finds = code.match(/\.(findMany|findFirst|findUnique|count)\s*\(/g) ?? [];
      if (finds.length === 0) continue;
      const scopes = code.match(/clientId|portalToken/g) ?? [];
      if (scopes.length < finds.length) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('leaks no operator terminology into anything the owner reads', async () => {
    const { buildPortalView } = await import('@/lib/portal/view');
    const { buildIntelligence } = await import('@/lib/intelligence/engine');
    const { computeHealthCard } = await import('@/lib/health/health');
    const { getPackOrFallback } = await import('@/lib/packs');

    const pack = getPackOrFallback('clinic');
    const view = buildPortalView({
      intelligence: buildIntelligence({
        client: { id: 'c1', businessName: 'Test Clinic', vertical: 'clinic' },
        pack,
        themes: {
          praises: [
            {
              key: 'doctor_care',
              label: "Doctor's care",
              kind: 'PRAISE',
              severity: 'low',
              count: 8,
              itemIds: [],
            },
          ],
          issues: [
            {
              key: 'wait_time',
              label: 'Long waiting time',
              kind: 'ISSUE',
              severity: 'high',
              count: 6,
              itemIds: [],
            },
          ],
          analysedCount: 30,
          dimensions: [],
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
      }),
      card: computeHealthCard({ pack, snapshots: [], now: new Date() }),
      actions: [],
      snapshots: [],
      pack,
      themes: {
        praises: [
          { key: 'doctor_care', label: "Doctor's care", kind: 'PRAISE', severity: 'low', count: 8, itemIds: [] },
        ],
        issues: [
          { key: 'wait_time', label: 'Long waiting time', kind: 'ISSUE', severity: 'high', count: 6, itemIds: [] },
        ],
        analysedCount: 30,
        dimensions: [],
      },
    });

    const serialised = JSON.stringify(view);
    for (const banned of [
      'ANALYSIS_VERSION',
      'INTELLIGENCE_VERSION',
      'taxonomy',
      'triage',
      'draftStatus',
      'priorityRank',
      'snapshotId',
      'insightId',
      'ATTENTION',
      'INSUFFICIENT_DATA',
      'Groq',
    ]) {
      expect(serialised, `${banned} reached the owner's view`).not.toContain(banned);
    }
  });
});

describe('V1 hard rules — the customer feedback gateway is a front door, not a back channel (M14)', () => {
  const GATEWAY_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/gateway/') ||
      file === 'src/lib/feedback/ingest.ts' ||
      file === 'src/lib/actions/gateway.ts' ||
      file.startsWith('src/app/(feedback)/') ||
      file.startsWith('src/components/feedback-gateway/') ||
      file === 'src/components/forms/gateway-forms.tsx' ||
      file.startsWith('src/app/(print)/print/feedback/') ||
      file.startsWith('src/app/(app)/clients/[id]/qr/'),
  );

  /** What a customer's phone can load. */
  const PUBLIC_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/app/(feedback)/') || file.startsWith('src/components/feedback-gateway/'),
  );

  it('has a gateway to guard', () => {
    expect(GATEWAY_FILES.length).toBeGreaterThan(8);
    expect(PUBLIC_FILES.length).toBeGreaterThan(3);
  });

  it('makes no outbound call of any kind — the QR is rendered offline', () => {
    const offenders = GATEWAY_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|got\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('reaches no AI provider — a public page never triggers a model call', () => {
    const offenders = GATEWAY_FILES.filter(({ code }) =>
      /runCompletion|draftReplyWithAi|classifyReviews|analyseClientFeedback|@\/lib\/ai\b|@\/lib\/ai\//.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('schedules nothing and measures nothing about anyone', () => {
    const offenders = GATEWAY_FILES.filter(({ code }) =>
      /setInterval|cron|analytics|telemetry|gtag|posthog|mixpanel|segment\.|track\s*\(/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('shows a customer nothing the owner told RepOS and nothing RepOS concluded', () => {
    const offenders = PUBLIC_FILES.filter(({ code }) =>
      /@\/lib\/(intelligence|improve|context|comms|portal|minutes|snapshots|health|command|reply|analysis)\b/.test(
        code,
      ),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never gates: the thank-you page cannot see the rating or the words', () => {
    const thanks = PUBLIC_FILES.filter(({ file }) => file.includes('/thanks/'));
    expect(thanks.length).toBe(1);
    for (const { code } of thanks) {
      expect(code).not.toMatch(/stars|sentiment|rating|searchParams|reviewItem|ingest/i);
    }
    // And the redirect after sending carries the token only.
    const action = EXECUTABLE.find(({ file }) => file === 'src/lib/actions/gateway.ts');
    expect(action).toBeDefined();
    expect(action?.code).not.toMatch(/redirect\([^)]*(stars|text|sentiment)/);
  });

  it('uses no database id and no NEXT_PUBLIC_ value in a customer address', () => {
    const offenders = GATEWAY_FILES.filter(({ code }) =>
      /`\/feedback\/\$\{[^}]*(clientId|client\.id|\.id\b)[^}]*\}/.test(code) || code.includes('NEXT_PUBLIC_'),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('keeps every write scoped to the client the token resolved to', () => {
    const service = EXECUTABLE.find(({ file }) => file === 'src/lib/gateway/service.ts');
    expect(service).toBeDefined();
    // The only feedback write in the gateway goes through the shared intake,
    // and that intake is always handed the resolved client id.
    expect(service?.code).not.toMatch(/reviewItem\.(create|createMany|upsert|update|updateMany)/);
    expect(service?.code).toMatch(/ingestFeedback\(\s*db,\s*gateway\.clientId/);
  });

  it('stores nothing about the person: no identity column exists for a customer', () => {
    const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
    const gateway = schema.slice(schema.indexOf('model FeedbackGateway'));
    const columns = gateway
      .slice(0, gateway.indexOf('}'))
      .split('\n')
      .filter((line) => !line.trim().startsWith('//') && !line.includes('model '))
      .join('\n');
    expect(columns).not.toMatch(/name|phone|email|address|ip\b|device|customer/i);
    const review = schema.slice(schema.indexOf('model ReviewItem'));
    const reviewBlock = review.slice(0, review.indexOf('\n}'));
    expect(reviewBlock).not.toMatch(/customerName|customerPhone|customerEmail|ipAddress|deviceId/i);
  });

  it('names no platform in the source list and privileges none', async () => {
    const { INGEST_SOURCES } = await import('@/lib/feedback/service');
    expect(INGEST_SOURCES).toContain('REP_OS_QR');
    expect(INGEST_SOURCES.join(' ').toLowerCase()).not.toMatch(/google|whatsapp|meta|facebook/);
  });
});

describe('V1 hard rules — responsibility is computed, never scheduled or fetched (M15)', () => {
  const RESPONSIBILITY_FILES = EXECUTABLE.filter(
    ({ file }) =>
      file.startsWith('src/lib/responsibility/') ||
      file === 'src/components/responsibility-panel.tsx' ||
      file === 'src/components/portal/responsibility.tsx',
  );

  it('has a responsibility layer to guard', () => {
    expect(RESPONSIBILITY_FILES.length).toBeGreaterThan(2);
  });

  it('makes no outbound call of any kind', () => {
    const offenders = RESPONSIBILITY_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|got\s*\(|XMLHttpRequest|WebSocket|EventSource/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('reaches no AI provider: every state is application code', () => {
    const offenders = RESPONSIBILITY_FILES.filter(({ code }) =>
      /runCompletion|draftReplyWithAi|classifyReviews|@\/lib\/ai\b|@\/lib\/ai\//.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('runs on no timer, no cron, no background loop and no notification', () => {
    const offenders = RESPONSIBILITY_FILES.filter(({ code }) =>
      /setInterval|setTimeout|cron|revalidate\s*:\s*\d|refetchInterval|Notification|serviceWorker|webpush|queue|worker/i.test(
        code,
      ),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('measures nothing about anyone', () => {
    const offenders = RESPONSIBILITY_FILES.filter(({ code }) =>
      /analytics|telemetry|gtag|posthog|mixpanel|segment\.|track\s*\(/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('stores nothing: the state is derived from rows on every read', () => {
    const offenders = RESPONSIBILITY_FILES.filter(({ code }) =>
      /\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('computes no intelligence of its own — it reads M10, M11 and M12', () => {
    const engine = EXECUTABLE.find(({ file }) => file === 'src/lib/responsibility/engine.ts');
    expect(engine).toBeDefined();
    // No theme counting, no share arithmetic, no sentiment, no threshold of its own.
    expect(engine?.code).not.toMatch(/themesJson|issueTags|praiseTags|sentiment ===|\.share\b\s*[<>]|MIN_[A-Z_]+\s*=\s*\d/);
    expect(engine?.code).toMatch(/@\/lib\/portal\/view/);
    expect(engine?.code).toMatch(/@\/lib\/intelligence\/engine/);
  });

  it('links only inside RepOS', () => {
    const offenders = RESPONSIBILITY_FILES.filter(({ code }) => EXTERNAL_LINK.test(code)).map(
      ({ file }) => file,
    );
    expect(offenders).toEqual([]);
  });
});

describe('V1 hard rules — nothing acts without an operator behind it (M16)', () => {
  const ACTION_FILES = EXECUTABLE.filter(({ file }) => file.startsWith('src/lib/actions/'));

  /**
   * The three that must NOT be guarded, and why each one is safe.
   *
   *   loginAction   — it is how a session is obtained; guarding it would make
   *                   signing in impossible.
   *   logoutAction  — throwing away a session must work even without one.
   *   submitCustomerFeedbackAction
   *                 — the customer's own submission. It is authorized by the
   *                   gateway token in the URL, is rate-limited, and can only
   *                   ever insert against the client that token resolves to.
   */
  /**
   * M20 added the account entry points. Every one of them is an action that
   * cannot require a session because it is how a session is obtained, ended or
   * recovered — the same reason loginAction was exempt in M16. Each is still
   * constrained: the sign-in and sign-up actions hand the credential to
   * Supabase Auth and believe nothing the form said about identity, the reset
   * request always reports the same result whether or not the address exists,
   * and updatePasswordAction requires the recovery session Supabase itself
   * established before it will set anything.
   */
  const PUBLIC_ACTIONS = new Set([
    'loginAction',
    'logoutAction',
    'submitCustomerFeedbackAction',
    'signUpAction',
    'signInAction',
    'signOutAction',
    'requestPasswordResetAction',
    'updatePasswordAction',
  ]);


  it('has actions to guard', () => {
    expect(ACTION_FILES.length).toBeGreaterThan(5);
  });

  /**
   * THE AUTHORIZATION MATRIX (M20 Stage 3).
   *
   * Every action is named here with the level it must require. This is a
   * stronger guard than the M16 version it replaces: that one asked only
   * whether SOME check was present, so an owner-only action quietly downgraded
   * to member-level would have passed. This asserts the level itself, and a
   * new action missing from the table fails rather than defaulting to
   * anything.
   *
   * ADMIN  — whole installation, no single tenant behind it.
   * OWNER  — reshapes the business, or destroys something staff should not.
   * MEMBER — day-to-day work inside one business.
   */
  const MATRIX: Record<string, 'ADMIN' | 'OWNER' | 'MEMBER'> = {
    analyseFeedbackAction: 'MEMBER',
    takeBackupAction: 'ADMIN',
    createClientAction: 'ADMIN',
    updateClientAction: 'OWNER',
    archiveClientAction: 'ADMIN',
    restoreClientAction: 'ADMIN',
    purgeClientAction: 'ADMIN',
    saveVoiceProfileAction: 'OWNER',
    savePolicyAction: 'OWNER',
    saveCompetitorsAction: 'OWNER',
    seedDemoDataAction: 'ADMIN',
    createContextAction: 'MEMBER',
    updateContextAction: 'MEMBER',
    retireContextAction: 'MEMBER',
    restoreContextAction: 'MEMBER',
    deleteContextAction: 'OWNER',
    answerQuestionAction: 'MEMBER',
    importFeedbackAction: 'MEMBER',
    addFeedbackItemAction: 'MEMBER',
    deleteFeedbackItemAction: 'OWNER',
    savePublicReviewUrlAction: 'OWNER',
    setGatewayEnabledAction: 'OWNER',
    savePublicBaseUrlAction: 'ADMIN',
    createActionFromInsightAction: 'MEMBER',
    decideActionAction: 'MEMBER',
    moveActionAction: 'MEMBER',
    measureActionAction: 'MEMBER',
    recordLearningAction: 'MEMBER',
    saveReviewLinkAction: 'OWNER',
    saveKitConfigAction: 'OWNER',
    setKitInstalledAction: 'MEMBER',
    createMinuteAction: 'MEMBER',
    updateMinuteAction: 'MEMBER',
    deleteMinuteAction: 'OWNER',
    setPortalLinkSentAction: 'OWNER',
    draftRepliesAction: 'MEMBER',
    regenerateDraftAction: 'MEMBER',
    saveDraftAction: 'MEMBER',
    setHandledAction: 'MEMBER',
    createSnapshotAction: 'MEMBER',
    deleteSnapshotAction: 'OWNER',
    inviteMemberAction: 'OWNER',
    revokeInviteAction: 'OWNER',
    setMembershipAction: 'OWNER',
    completeOnboardingAction: 'MEMBER',
  };

  it('gates every action at the level the matrix says, as its first statement', () => {
    // Server Actions are POSTs addressed by an internal action id, not by the
    // page path, so a path-matching middleware rule cannot be the gate. The
    // check has to be the first thing each action does — an action that reads
    // a client id before checking who is asking has already trusted it.
    const wrong: string[] = [];
    for (const { file, code } of ACTION_FILES) {
      const pattern = /export\s+async\s+function\s+(\w+)\s*\([\s\S]*?\)\s*:\s*Promise<[^>]*>\s*\{\s*([^\n]*)/g;
      for (const match of code.matchAll(pattern)) {
        const name = match[1]!;
        const first = match[2] ?? '';
        if (PUBLIC_ACTIONS.has(name)) continue;

        // Accepting an invitation is authorized by the token and the matching
        // email, not by a membership: the person is not on the team yet.
        if (name === 'completeOnboardingAction' || name === 'acceptInviteAction') {
          if (!/await\s+currentActor\(/.test(first)) wrong.push(`${file}:${name} should resolve the actor`);
          continue;
        }

        const expected = MATRIX[name];
        if (!expected) {
          wrong.push(`${file}:${name} is not in the authorization matrix`);
          continue;
        }
        if (expected === 'ADMIN') {
          if (!/await\s+adminGate\(\)/.test(first)) wrong.push(`${file}:${name} should use adminGate`);
          continue;
        }
        // A plain string check: the call is written the same way everywhere,
        // and an exact match cannot be fooled by a regex escaping mistake.
        if (!first.includes(`await tenantGate(form, '${expected}'`)) {
          wrong.push(`${file}:${name} should be tenantGate '${expected}'`);
        }
      }
    }
    expect(wrong).toEqual([]);
  });

  it('never lets an action trust a client id it has not checked', () => {
    // Reading the id is fine; reading it BEFORE the gate is not, because the
    // rest of the action then runs on an unverified value.
    const offenders: string[] = [];
    for (const { file, code } of ACTION_FILES) {
      for (const match of code.matchAll(
        /export\s+async\s+function\s+(\w+)\s*\([\s\S]*?\)\s*:\s*Promise<[^>]*>\s*\{([\s\S]*?)\n\}/g,
      )) {
        const name = match[1]!;
        const body = match[2] ?? '';
        if (PUBLIC_ACTIONS.has(name)) continue;
        const gateAt = body.search(/await\s+(adminGate|tenantGate|currentActor)\(/);
        const readAt = body.search(/str\(form, 'clientId'\)/);
        if (readAt !== -1 && (gateAt === -1 || readAt < gateAt)) {
          offenders.push(`${file}:${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('puts the whole operator workspace behind the guard', () => {
    for (const path of ['src/app/(app)/layout.tsx', 'src/app/(print)/layout.tsx']) {
      const layout = EXECUTABLE.find(({ file }) => file === path);
      expect(layout, path).toBeDefined();
      expect(layout?.code, path).toMatch(/await requireOperator\(\)/);
    }
  });

  it('leaves the customer and owner routes free of any sign-in', () => {
    // A customer with a QR and an owner with a link must never meet a password.
    const publicFiles = EXECUTABLE.filter(
      ({ file }) => file.startsWith('src/app/(feedback)/') || file.startsWith('src/app/(portal)/'),
    );
    expect(publicFiles.length).toBeGreaterThan(3);
    const offenders = publicFiles
      .filter(({ code }) => /requireOperator|isOperator|readSession|SESSION_COOKIE/.test(code))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe('V1 hard rules — secrets stay on the server (M16)', () => {
  // The names this guard watches must be the names that currently exist.
  // Two of the originals — the operator password hash and the session secret
  // — were deleted in M20 when Supabase Auth became the only identity system,
  // so a regex still naming those was guarding nothing, while the secrets it
  // should have been guarding went unlisted.
  const SECRET_NAMES =
    /REPOS_OPERATOR_PASSWORD_HASH|REPOS_SESSION_SECRET|REPOS_BOOTSTRAP_SECRET|GROQ_API_KEY|GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|DATABASE_URL|DIRECT_DATABASE_URL|PUBLIC_DATABASE_URL/;

  it('defines no browser-visible environment variable at all', () => {
    const offenders = EXECUTABLE.filter(({ code }) => /NEXT_PUBLIC_/.test(code)).map(
      ({ file }) => file,
    );
    expect(offenders).toEqual([]);
  });

  it('never reads a secret from a client component', () => {
    const offenders = EXECUTABLE.filter(
      ({ code }) => /^['"]use client['"]/m.test(code) && SECRET_NAMES.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never names a secret on a page a customer or owner can open', () => {
    const offenders = EXECUTABLE.filter(
      ({ file, code }) =>
        (file.startsWith('src/app/(feedback)/') ||
          file.startsWith('src/app/(portal)/') ||
          file.startsWith('src/components/portal/') ||
          file.startsWith('src/components/feedback-gateway/')) &&
        (SECRET_NAMES.test(code) || /process\.env/.test(code)),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('keeps the password out of the database, so a stolen backup is not a key', () => {
    // M20 strengthened this rather than relaxing it. RepOS used to hold one
    // operator password hash in the environment; it now holds none at all,
    // because Supabase Auth owns identity outright. There is no password
    // column, no reset-token table and no second sign-in path to forget about.
    const schema = readFileSync(join(ROOT, 'prisma', 'schema.prisma'), 'utf8');
    expect(schema).not.toMatch(/passwordHash|credential|sessionToken/i);
    expect(schema).not.toMatch(/model PasswordResetToken/);
  });

  it('shows no error detail to anyone', () => {
    for (const path of ['src/app/(app)/error.tsx', 'src/app/global-error.tsx']) {
      const page = EXECUTABLE.find(({ file }) => file === path);
      expect(page, path).toBeDefined();
      // Not the message, not the digest, not a stack.
      expect(page?.code, path).not.toMatch(/\{\s*error\.(message|digest|stack)\s*\}/);
    }
  });
});

describe('V1 hard rules — the address in a printed QR is deliberate (M16)', () => {
  it('never builds a customer-facing address from a request header in production', () => {
    const origin = EXECUTABLE.find(({ file }) => file === 'src/lib/gateway/origin.ts');
    expect(origin).toBeDefined();
    expect(origin?.code).toMatch(/NODE_ENV === 'production'/);
  });

  it('sends every QR and owner link through the one resolver', () => {
    const resolver = EXECUTABLE.find(({ file }) => file === 'src/lib/config/public-url.ts');
    expect(resolver).toBeDefined();
    const gateway = EXECUTABLE.find(({ file }) => file === 'src/lib/gateway/service.ts');
    expect(gateway?.code).toMatch(/resolvePublicBaseUrl/);
  });

  it('still sends customers to the RepOS feedback page, never straight to a review site', () => {
    // M14's canonical flow, unchanged by M16: no gating, no branch on rating.
    const gateway = EXECUTABLE.find(({ file }) => file === 'src/lib/gateway/service.ts');
    expect(gateway?.code).toMatch(/feedbackUrl\(/);
    expect(gateway?.code).not.toMatch(/rating\s*[<>]=?\s*[1-5][\s\S]{0,80}publicReviewUrl/);
  });
});

describe('V1 hard rules — backups stay on this computer (M16)', () => {
  const BACKUP_FILES = EXECUTABLE.filter(
    ({ file }) => file.startsWith('src/lib/backup/') || file === 'src/lib/actions/backup.ts',
  );

  it('has a backup to guard', () => {
    expect(BACKUP_FILES.length).toBeGreaterThan(1);
  });

  it('uploads nothing, anywhere', () => {
    const offenders = BACKUP_FILES.filter(({ code }) =>
      /fetch\s*\(|axios|s3|aws|gcs|dropbox|drive|upload/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never writes a copy where a browser could fetch it', () => {
    const service = EXECUTABLE.find(({ file }) => file === 'src/lib/backup/service.ts');
    expect(service?.code).not.toMatch(/['"]public['"]/);
    expect(service?.code).toMatch(/backups/);
  });

  it('schedules nothing on its own', () => {
    const offenders = BACKUP_FILES.filter(({ code }) =>
      /setInterval|setTimeout|cron|node-schedule/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe('V1 hard rules — the printed card asks everyone, every time (M17)', () => {
  const PACKS = listPacks();

  /**
   * Phrasing that makes the ask conditional on the customer already being
   * pleased.
   *
   * This is the one place real sentiment gating ever existed in RepOS, and it
   * was not in code: every vertical's staff script told staff to mention the
   * QR "after the guest said they enjoyed the meal", "once the client has seen
   * the finished result", "if you are happy with how it turned out". The same
   * printed sheet carried a box saying "Never show the QR only to guests who
   * looked happy" — and staff follow the script, not the box.
   */
  const CONDITIONAL =
    /\b(if|once|when|after)\b[^.]{0,60}\b(happy|pleased|enjoyed|satisfied|delighted|went well|worked for you|looked after|feel better|smooth(ly)?|good experience|liked it)\b/i;

  /** An ask that is about other people seeing it, i.e. a public review. */
  const PUBLIC_ASK =
    /\b(helps?|help)\b[^.]{0,40}\b(other|others|next|another)\b[^.]{0,40}\b(decide|choose|choosing|find)\b|\bpublic review\b|\bleave a review\b/i;

  it('has packs to guard', () => {
    expect(PACKS.length).toBeGreaterThan(4);
  });

  it('never tells staff to wait until a customer seems happy', () => {
    const offenders: string[] = [];
    for (const pack of PACKS) {
      const script = pack.staffAskScript;
      for (const [field, value] of Object.entries({
        when: script.when,
        line: script.line,
        hinglishLine: script.hinglishLine,
        marathiLine: script.marathiLine,
        // `kit.moment` is what the printed staff card actually shows under
        // "When to mention it", and it overrides `staffAskScript.when`. It
        // carried the same gating cue, and the first version of this guard
        // missed it — a browser check on a production build caught it (M17).
        'kit.moment': pack.kit?.moment ?? '',
      })) {
        if (CONDITIONAL.test(value)) offenders.push(`${pack.id}.${field}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('shows the same unconditional cue on the printed card as in the script', async () => {
    const { buildKitContent } = await import('@/lib/kit/content');
    for (const pack of PACKS) {
      const content = buildKitContent({
        pack,
        businessName: 'Test Business',
        feedbackUrl: 'https://repos.example.com/feedback/gp7f8yv6f9zyauwhvxxysm',
      });
      // What actually gets printed, not what the pack happens to store.
      expect(CONDITIONAL.test(content.staffScript.when), `${pack.id}: ${content.staffScript.when}`).toBe(false);
      expect(CONDITIONAL.test(content.staffScript.english), pack.id).toBe(false);
      expect(CONDITIONAL.test(content.moment), `${pack.id}: ${content.moment}`).toBe(false);
    }
  });

  it('never has staff ask for a public review', () => {
    // The card opens the business's own private feedback page. Asking out loud
    // for something that "helps other people decide" describes a public
    // listing, which is not what the QR does.
    const offenders: string[] = [];
    for (const pack of PACKS) {
      for (const value of [pack.staffAskScript.line, pack.staffAskScript.hinglishLine]) {
        if (PUBLIC_ASK.test(value)) offenders.push(`${pack.id}: ${value}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('says out loud, in every pack, that the QR goes to everyone', () => {
    for (const pack of PACKS) {
      const rules = pack.staffAskScript.doNot.join(' ').toLowerCase();
      expect(rules, pack.id).toMatch(/everyone|every time|only the happy|looked happy/);
    }
  });

  it('offers no incentive for feedback in any pack', () => {
    for (const pack of PACKS) {
      const rules = pack.staffAskScript.doNot.join(' ').toLowerCase();
      expect(rules, pack.id).toMatch(/discount|gift|reward|free/);
    }
  });
});

describe('V1 hard rules — one QR, and it is RepOS (M17)', () => {
  it('builds the printed kit from the feedback gateway, not a pasted link', () => {
    const kit = EXECUTABLE.find(({ file }) => file === 'src/lib/kit/service.ts');
    expect(kit).toBeDefined();
    // The QR is rendered from the gateway token and the installation address.
    expect(kit?.code).toMatch(/ensureGateway/);
    expect(kit?.code).toMatch(/buildFeedbackUrl|feedbackUrl\(/);
    expect(kit?.code).toMatch(/generateQrSvg\(feedbackUrl\)/);
  });

  it('never renders a QR for the optional public review link', () => {
    const offenders = EXECUTABLE.filter(
      ({ file, code }) =>
        (file.startsWith('src/lib/kit/') || file.startsWith('src/app/(print)/')) &&
        /generateQrSvg\(\s*(config\.qrTargetUrl|publicReviewUrl|reviewUrl)/.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('keeps the kit printable for a business with no public listing', async () => {
    const { computeReadiness } = await import('@/lib/kit/content');
    const ready = computeReadiness({
      businessName: 'Corner Cafe',
      feedbackUrl: 'https://repos.example.com/feedback/gp7f8yv6f9zyauwhvxxysm',
    });
    expect(ready.ready).toBe(true);
    // Readiness must not even mention a review link as a blocker.
    expect(JSON.stringify(ready)).not.toMatch(/review link/i);
  });

  it('refuses to point the optional public link back at RepOS', async () => {
    const { checkReviewUrl } = await import('@/lib/kit/content');
    expect(checkReviewUrl('https://repos.example.com/feedback/abc').ok).toBe(false);
    expect(checkReviewUrl('https://repos.example.com/portal/abc').ok).toBe(false);
  });

  it('ships no placeholder link that could reach a printed card', () => {
    const offenders = EXECUTABLE.filter(({ code }) =>
      /example\.com\/replace|your-review-link|REPLACE_ME/i.test(code),
    ).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});

describe('V1 hard rules — a business needs no Google to be served (M17)', () => {
  it('gives every new client a feedback page at creation, not on a tab visit', () => {
    const service = EXECUTABLE.find(({ file }) => file === 'src/lib/clients/service.ts');
    expect(service?.code).toMatch(/gateway:\s*\{\s*create/);
  });

  it('scores onboarding on nothing that requires a public listing', () => {
    const page = EXECUTABLE.find(
      ({ file }) => file === 'src/app/(app)/clients/[id]/page.tsx',
    );
    expect(page).toBeDefined();
    // The checklist is the operator's answer to "is this business set up?".
    const checklist = page?.code.slice(
      page.code.indexOf('const checklist = ['),
      page.code.indexOf('const remaining ='),
    ) ?? '';
    expect(checklist.length).toBeGreaterThan(100);
    expect(checklist).not.toMatch(/baselineRating|baselineReviewCount|competitor/i);
    expect(checklist).toMatch(/Feedback page switched on/);
    expect(checklist).toMatch(/Owner has been sent their link/);
  });

  it('lets a check-in see the feedback that arrived in its window', () => {
    // Without this the whole comparison half of the product is dead for a
    // client whose only channel is the QR: every insight reads
    // INSUFFICIENT_DATA no matter how much feedback has come in.
    const snapshots = EXECUTABLE.find(
      ({ file }) => file === 'src/lib/snapshots/service.ts',
    );
    expect(snapshots?.code).toMatch(/snapshotId: null/);
    expect(snapshots?.code).toMatch(/windowed/);
  });
});

describe('V1 hard rules — the owner reads sentences, not labels (M18)', () => {
  const PACKS_M18 = listPacks();

  /**
   * Every praise label is rendered inside "Customers praise your <label>."
   *
   * So it has to name a thing. Nine of them were adjectives or past
   * participles, which produced "Customers praise your clean and well-kept"
   * on the first line of the owner's Home page — the single most visible
   * string in the product.
   */

  it('has praise labels to guard', () => {
    const total = PACKS_M18.reduce((n, p) => n + p.praiseTaxonomy.length, 0);
    expect(total).toBeGreaterThan(30);
  });

  it('names a thing in every praise label, so "your <label>" reads', () => {
    const offenders: string[] = [];
    for (const pack of PACKS_M18) {
      for (const t of pack.praiseTaxonomy) {
        const sentence = `Customers praise your ${t.label.toLowerCase()}.`;
        // A label that is only adjectives leaves the possessive dangling.
        const words = t.label.toLowerCase().replace(/[/,]/g, ' ').split(/\s+/).filter(Boolean);
        const bare = words.every((w) =>
          /^(clean|hygienic|well-kept|honest|transparent|flexible|accommodating|on|time|no|pressure|delivered|showed|and|or|little)$/.test(w),
        );
        if (bare) offenders.push(`${pack.id}.${t.key}: "${sentence}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never leaves a praise label starting with a bare participle', () => {
    const offenders: string[] = [];
    for (const pack of PACKS_M18) {
      for (const t of pack.praiseTaxonomy) {
        if (/^(showed|delivered|provided|gave)\b/i.test(t.label)) {
          offenders.push(`${pack.id}.${t.key}: ${t.label}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never tells the owner a comparison needs more feedback than it has', () => {
    // "48 of the 10 pieces needed so far" was real output on every busy
    // client, on four separate surfaces.
    const view = EXECUTABLE.find(({ file }) => file === 'src/lib/portal/view.ts');
    const engine = EXECUTABLE.find(({ file }) => file === 'src/lib/responsibility/engine.ts');
    expect(view?.code).toMatch(/have >= MIN_FEEDBACK_TO_MEASURE/);
    expect(engine?.code).toMatch(/awaiting\.have >= .*awaiting\.need/);
  });

  it('claims a clear read only when nothing at all is waiting on the owner', () => {
    // It used to test DO_NOW only, so "Found no new issue strong enough to
    // recommend action" printed directly under a live follow-up.
    const engine = EXECUTABLE.find(({ file }) => file === 'src/lib/responsibility/engine.ts');
    expect(engine?.code).toMatch(/!args\.hasNeedsYou[\s\S]{0,120}Found no new issue/);
  });
  it('never lets a server action read a constant out of a client component', () => {
    // M19. The customer form declared the names its dimension fields post
    // under, and the server action imported them from there. Across that
    // boundary an imported value is a reference to the client module, not the
    // string — so the action matched nothing and silently dropped every
    // rating a customer gave. It typechecked, it built, and the tests passed;
    // only submitting the real form showed it.
    const clientModules = new Set(
      EXECUTABLE.filter(({ code }) => /^\s*['"]use client['"]/.test(code)).map(({ file }) =>
        file.replace(/^src\//, '@/').replace(/\.tsx?$/, ''),
      ),
    );
    const offenders: string[] = [];
    for (const { file, code } of EXECUTABLE) {
      if (!/^\s*['"]use server['"]/.test(code)) continue;
      for (const match of code.matchAll(/^import\s+(?!type\s)([^;]*?)\s+from\s+'([^']+)'/gm)) {
        const [, clause, from] = match;
        if (!clause || !from || !clientModules.has(from)) continue;
        // A component itself is fine to import; a bare value is not.
        if (/\{[^}]*\}/.test(clause)) offenders.push(`${file} imports ${clause.trim()} from ${from}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
