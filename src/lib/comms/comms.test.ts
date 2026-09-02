import { describe, expect, it } from 'vitest';
import { getPackOrFallback, listPacks, _resetPackCache } from '@/lib/packs';
import { resolveVoice, type EffectiveVoice, type LanguageMix } from '@/lib/reply/voice';
import { checkDraft } from '@/lib/reply/safety';
import type { ThemeSummary, ThemeSummaryRow } from '@/lib/feedback/analysis';
import type { Pulse, PulsePeriod } from '@/lib/health/health';
import {
  INSIGHT_VERSION,
  MIN_MENTIONS_TO_NAME,
  buildInsight,
  insightNumbers,
  tierFor,
  type OwnerInsight,
} from './insight';
import {
  COMMS_LABELS,
  COMMS_TYPES,
  composeActionMessage,
  composeFollowUp,
  composeOwnerMessages,
  composeOwnerUpdate,
  ownerLanguage,
} from './compose';

_resetPackCache();

const clinic = getPackOrFallback('clinic');
const salon = getPackOrFallback('salon');
const restaurant = getPackOrFallback('restaurant');

const NOW = new Date('2026-03-16T00:00:00.000Z');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function theme(
  key: string,
  label: string,
  kind: 'PRAISE' | 'ISSUE',
  count: number,
  severity: 'low' | 'medium' | 'high' = 'high',
): ThemeSummaryRow {
  return {
    key,
    label,
    kind,
    severity,
    count,
    itemIds: Array.from({ length: count }, (_, i) => `${key}-${i}`),
  };
}

function themes(
  praises: ThemeSummaryRow[],
  issues: ThemeSummaryRow[],
  analysedCount: number,
): ThemeSummary {
  return { praises, issues, analysedCount };
}

const NO_PULSE: Pulse = {
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
};

/** A period as the pulse engine builds one, with the themes it counted. */
function period(
  id: string,
  label: string,
  capturedAt: string,
  feedbackCount: number,
  issues: Array<[string, string, number]>,
  praises: Array<[string, string, number]> = [],
): PulsePeriod {
  const counts = (rows: Array<[string, string, number]>) =>
    rows.map(([key, label, count]) => ({
      key,
      label,
      count,
      severity: 'high' as const,
      qualifies: count >= MIN_MENTIONS_TO_NAME,
    }));

  return {
    snapshotId: id,
    label,
    capturedAt: new Date(capturedAt),
    feedbackCount,
    distribution: {
      total: feedbackCount,
      counts: { POSITIVE: 0, NEGATIVE: 0, MIXED: 0, NEUTRAL: 0, UNKNOWN: 0 },
      shares: { POSITIVE: 0, NEGATIVE: 0, MIXED: 0, NEUTRAL: 0, UNKNOWN: 0 },
      reliable: false,
      note: '',
    },
    rating: null,
    reviewCount: null,
    unansweredCount: null,
    topIssues: counts(issues),
    topPraises: counts(praises),
  };
}

const WITH_PULSE: Pulse = {
  ...NO_PULSE,
  available: true,
  reason: '',
  direction: 'IMPROVING',
  directionLabel: 'Improving',
  previous: period('s1', '1 Feb', '2026-02-01T00:00:00.000Z', 24, [
    ['wait_time', 'Long waiting time', 9],
  ]),
  current: period('s2', '12 Mar', '2026-03-12T00:00:00.000Z', 22, [
    ['wait_time', 'Long waiting time', 4],
  ]),
  periodDays: 39,
  notableChanges: [
    {
      key: 'wait_time',
      label: 'Long waiting time',
      current: 4,
      previous: 9,
      delta: -5,
      // Exactly what the pulse engine writes: movement only, no theme name.
      note: '9 → 4 mentions',
    },
  ],
};

function voiceFor(pack = clinic, businessName = 'Sunrise Dental Clinic'): EffectiveVoice {
  return resolveVoice(pack, { businessName, vertical: pack.id }, null, null);
}

function inLanguage(voice: EffectiveVoice, language: LanguageMix): EffectiveVoice {
  return { ...voice, languageMix: language };
}

/** A clinic with a clear main issue and clear praise. */
function clinicInsight(overrides: Partial<Parameters<typeof buildInsight>[0]> = {}) {
  return buildInsight({
    client: { id: 'c1', businessName: 'Sunrise Dental Clinic', vertical: 'clinic' },
    pack: clinic,
    themes: themes(
      [
        theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 28),
        theme('clean_facility', 'Clean, well-kept clinic', 'PRAISE', 12),
        theme('short_wait', 'Little or no waiting', 'PRAISE', 2),
      ],
      [
        theme('wait_time', 'Long waiting time', 'ISSUE', 9),
        theme('staff_behaviour', 'Reception / staff behaviour', 'ISSUE', 4),
        theme('billing_clarity', 'Unclear or unexpected billing', 'ISSUE', 1),
      ],
      50,
    ),
    totalFeedback: 50,
    pulse: NO_PULSE,
    recentlyDone: [],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------

describe('the insight is built from stored rows only', () => {
  it('carries what customers love and dislike, with the evidence', () => {
    const insight = clinicInsight();

    expect(insight.loves[0]?.label).toBe("Doctor's care and explanation");
    expect(insight.loves[0]?.count).toBe(28);
    expect(insight.loves[0]?.itemIds.length).toBe(28);
    expect(insight.dislikes[0]?.label).toBe('Long waiting time');
    expect(insight.version).toBe(INSIGHT_VERSION);
  });

  it('picks the most repeated issue as the main one', () => {
    expect(clinicInsight().topIssue?.key).toBe('wait_time');
  });

  it('ignores a theme that has not been mentioned often enough', () => {
    const insight = clinicInsight();
    const rare = insight.dislikes.find((t) => t.key === 'billing_clarity');
    expect(rare?.qualifies).toBe(false);
    expect(MIN_MENTIONS_TO_NAME).toBe(3);
  });

  it('has no main issue when nothing clears the floor', () => {
    const insight = clinicInsight({
      themes: themes([], [theme('wait_time', 'Long waiting time', 'ISSUE', 2)], 12),
    });
    expect(insight.topIssue).toBeNull();
    expect(insight.recommendation).toBeNull();
  });

  it('takes the recommended step from the vertical pack, never from thin air', () => {
    const insight = clinicInsight();
    const packAction = clinic.issueTaxonomy.find((t) => t.key === 'wait_time')?.action;
    expect(insight.recommendation?.action).toBe(packAction);
    expect(insight.recommendation?.mentions).toBe(9);
  });

  it('grades the evidence honestly', () => {
    expect(tierFor(0)).toBe('INSUFFICIENT');
    expect(tierFor(9)).toBe('INSUFFICIENT');
    expect(tierFor(10)).toBe('LIMITED');
    expect(tierFor(25)).toBe('STANDARD');
  });

  it('reports no comparison when there is nothing to compare', () => {
    const insight = clinicInsight();
    expect(insight.changes).toEqual([]);
    expect(insight.comparisonNote).toContain('snapshots');
  });

  it('takes changes from the intelligence engine, not its own arithmetic', () => {
    const insight = clinicInsight({ pulse: WITH_PULSE });
    expect(insight.changes.length).toBe(1);
    expect(insight.changes[0]?.direction).toBe('BETTER');
    // Same movement, same wording as the intelligence panel shows.
    expect(insight.changes[0]?.note).toBe('9 → 4 mentions');
    expect(insight.changes[0]?.previous).toBe(9);
    expect(insight.changes[0]?.current).toBe(4);
  });

  it('keeps everything the portal will need to show evidence', () => {
    const insight = clinicInsight();
    // The future client portal renders these fields; it must not have to
    // recompute any of them.
    for (const key of [
      'loves',
      'dislikes',
      'topIssue',
      'changes',
      'recommendation',
      'evidence',
      'recentlyDone',
    ] as const) {
      expect(insight).toHaveProperty(key);
    }
    expect(insight.loves.every((t) => Array.isArray(t.itemIds))).toBe(true);
  });

  it('is stable for the same input', () => {
    expect(clinicInsight()).toEqual(clinicInsight());
  });
});

// ---------------------------------------------------------------------------

describe('the owner update is useful and honest', () => {
  it('says what customers love, the main issue, and what to do', () => {
    const message = composeOwnerUpdate(clinicInsight(), voiceFor());

    expect(message.body).toContain('Sunrise Dental Clinic');
    expect(message.body).toContain("Doctor's care and explanation");
    expect(message.body).toContain('Long waiting time');
    expect(message.body).toContain('mentioned 9 times across all the feedback');
    expect(message.body).toContain('Recommended next step:');
    expect(message.body).toContain('Based on 50 reviews');
    expect(message.blocked).toBe(false);
  });

  it('states only figures the data supports', () => {
    const insight = clinicInsight();
    const message = composeOwnerUpdate(insight, voiceFor());
    const allowed = insightNumbers(insight);

    for (const match of message.body.matchAll(/\d+(?:\.\d+)?/g)) {
      expect(allowed.has(match[0]), `unsupported figure ${match[0]}`).toBe(true);
    }
    expect(message.problems.map((p) => p.code)).not.toContain('invented_number');
  });

  it('never claims a rating, a percentage or a period nobody measured', () => {
    const body = composeOwnerUpdate(clinicInsight(), voiceFor()).body;
    expect(body).not.toMatch(/\d+\s*%/);
    expect(body).not.toMatch(/\b\d\.\d\s*star/i);
    expect(body).not.toMatch(/last month|this month|last quarter/i);
  });

  it('leaves out the comparison when there is nothing to compare', () => {
    const message = composeOwnerUpdate(clinicInsight(), voiceFor());
    expect(message.body).not.toContain('What changed between');
    expect(message.notes.join(' ')).toMatch(/no period comparison/i);
  });

  it('includes the comparison when the pulse has one, and says what moved', () => {
    const message = composeOwnerUpdate(clinicInsight({ pulse: WITH_PULSE }), voiceFor());
    expect(message.body).toContain('What changed between your last two check-ins:');
    // A bare "4 → 9" tells the owner nothing; the theme has to be named.
    expect(message.body).toContain('Long waiting time');
    expect(message.body).toContain('9 → 4 mentions');
  });

  it('never claims the recommended step worked', () => {
    const insight = clinicInsight({
      pulse: WITH_PULSE,
      recentlyDone: [
        {
          id: 'm1',
          occurredAt: NOW,
          title: 'Owner added a second receptionist at peak hours',
          category: 'ACTION',
        },
      ],
    });
    const body = composeOwnerUpdate(insight, voiceFor()).body;
    expect(body).not.toMatch(/worked|it helped|thanks to|because of the change|has fixed/i);
    expect(body).toMatch(/We will check/i);
  });

  it('says plainly when there is nothing to report', () => {
    const insight = clinicInsight({ themes: themes([], [], 0), totalFeedback: 0 });
    const message = composeOwnerUpdate(insight, voiceFor());

    expect(message.body).toMatch(/not read enough/i);
    expect(message.body).not.toMatch(/Recommended next step/i);
    expect(message.body).not.toMatch(/\bmentioned\b/i);
    expect(message.blocked).toBe(false);
  });

  it('flags early days rather than sounding confident on nine reviews', () => {
    const insight = clinicInsight({
      themes: themes(
        [theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 4)],
        [theme('wait_time', 'Long waiting time', 'ISSUE', 3)],
        9,
      ),
      totalFeedback: 9,
    });
    const message = composeOwnerUpdate(insight, voiceFor());

    expect(message.body).toMatch(/too few to draw conclusions/i);
    expect(message.notes.join(' ')).toMatch(/early days/i);
  });

  it('says so when nothing has been complained about often enough', () => {
    const insight = clinicInsight({
      themes: themes(
        [theme('doctor_care', "Doctor's care and explanation", 'PRAISE', 30)],
        [],
        30,
      ),
    });
    const body = composeOwnerUpdate(insight, voiceFor()).body;
    expect(body).toMatch(/Nothing is coming up often enough/i);
    expect(body).not.toContain('The main issue is:');
  });

  it('reads as plain text a person can paste anywhere', () => {
    const body = composeOwnerUpdate(clinicInsight(), voiceFor()).body;
    expect(body).not.toMatch(/[<>]|\*\*|__|\{\{/);
    expect(body.trim()).toBe(body);
    expect(body.split('\n').length).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------

describe('an owner update is not a review reply', () => {
  it('carries counts and a recommendation, which a public reply never would', () => {
    const update = composeOwnerUpdate(clinicInsight(), voiceFor());
    expect(update.body).toMatch(/mentioned \d+ times/);
    expect(update.body).toContain('Recommended next step:');
  });

  it('never addresses the customer or apologises to them', () => {
    const body = composeOwnerUpdate(clinicInsight(), voiceFor()).body;
    expect(body).not.toMatch(/we are sorry|thank you for taking the time|your visit/i);
  });

  it('keeps the review reply as its own type, prepared per review', () => {
    expect(COMMS_TYPES).toContain('REVIEW_REPLY');
    expect(COMMS_LABELS.REVIEW_REPLY).toMatch(/review/i);
  });
});

// ---------------------------------------------------------------------------

describe('the action message and the follow-up', () => {
  it('states the step and what it is based on', () => {
    const message = composeActionMessage(clinicInsight(), voiceFor());
    expect(message.body).toContain('Recommended next step for Sunrise Dental Clinic');
    expect(message.body).toContain('This is based on 9 customers');
    expect(message.blocked).toBe(false);
  });

  it('does not record, schedule or complete anything', () => {
    // M8 suggests. Recording an action and measuring it is M11.
    const message = composeActionMessage(clinicInsight(), voiceFor());
    expect(message.body).not.toMatch(/marked as done|completed|scheduled|reminder set/i);
    expect(Object.keys(message)).not.toContain('status');
  });

  it('says nothing to recommend when nothing clears the floor', () => {
    const insight = clinicInsight({ themes: themes([], [], 12) });
    const message = composeActionMessage(insight, voiceFor());
    expect(message.body).toMatch(/Nothing is coming up often enough/i);
  });

  it('asks whether they got to it, without assuming they did', () => {
    const message = composeFollowUp(clinicInsight(), voiceFor());
    expect(message.body).toContain('Have you had a chance to look at this?');
    expect(message.body).not.toMatch(/since you fixed|now that you have|it worked/i);
  });

  it('mentions a recorded step without judging it', () => {
    const insight = clinicInsight({
      recentlyDone: [
        {
          id: 'm1',
          occurredAt: NOW,
          title: 'Agreed to review peak-hour staffing',
          category: 'DECISION',
        },
      ],
    });
    const message = composeFollowUp(insight, voiceFor());
    expect(message.body).toContain('Agreed to review peak-hour staffing');
    expect(message.body).not.toMatch(/improved|helped|worked/i);
  });
});

// ---------------------------------------------------------------------------

describe('the owner is written to in their own language', () => {
  const languages: LanguageMix[] = ['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI'];

  for (const language of languages) {
    it(`writes the whole update in ${language.toLowerCase()}`, () => {
      const message = composeOwnerUpdate(
        clinicInsight(),
        inLanguage(voiceFor(), language),
      );
      expect(message.language).toBe(language);
      expect(message.body.length).toBeGreaterThan(60);
      expect(message.body).toContain('Sunrise Dental Clinic');
      // Counts survive translation: the point of the update is the numbers.
      expect(message.body).toContain('9');
    });
  }

  it('uses Devanagari for Hindi and Marathi, and Latin for Hinglish', () => {
    const hindi = composeOwnerUpdate(clinicInsight(), inLanguage(voiceFor(), 'HINDI'));
    const marathi = composeOwnerUpdate(clinicInsight(), inLanguage(voiceFor(), 'MARATHI'));
    const hinglish = composeOwnerUpdate(
      clinicInsight(),
      inLanguage(voiceFor(), 'HINGLISH'),
    );

    expect(hindi.body).toMatch(/[ऀ-ॿ]/);
    expect(marathi.body).toMatch(/[ऀ-ॿ]/);
    expect(hinglish.body).not.toMatch(/[ऀ-ॿ]/);
    expect(hinglish.body.toLowerCase()).toContain('customer');
  });

  it('does not force an owner into English', () => {
    const marathi = composeOwnerUpdate(clinicInsight(), inLanguage(voiceFor(), 'MARATHI'));
    expect(marathi.body).not.toContain('Recommended next step:');
    expect(marathi.body).toContain('सुचवलेले पुढचे पाऊल:');
  });

  it('resolves "match the customer" to English, which is meaningless for an owner', () => {
    expect(ownerLanguage(inLanguage(voiceFor(), 'MIXED'))).toBe('ENGLISH');
  });
});

// ---------------------------------------------------------------------------

describe('the same engine writes for every vertical', () => {
  it('gives a salon its own advice and its own voice', () => {
    const insight = buildInsight({
      client: { id: 's1', businessName: 'Glow Salon', vertical: 'salon' },
      pack: salon,
      themes: themes(
        [theme('stylist_skill', 'Stylist skill and result', 'PRAISE', 11)],
        [theme('pricing_transparency', 'Price quoted vs price charged', 'ISSUE', 6)],
        30,
      ),
      totalFeedback: 30,
      pulse: NO_PULSE,
      recentlyDone: [],
    });

    const message = composeOwnerUpdate(insight, voiceFor(salon, 'Glow Salon'));
    const packAction = salon.issueTaxonomy.find(
      (t) => t.key === 'pricing_transparency',
    )?.action;

    expect(message.body).toContain('Glow Salon');
    expect(message.body).toContain('Price quoted vs price charged');
    expect(message.body).toContain(packAction ?? '__missing__');
    // The salon pack speaks Hinglish, so its owner is written to in Hinglish.
    expect(message.language).toBe('HINGLISH');
  });

  it('gives a restaurant its own advice', () => {
    const insight = buildInsight({
      client: { id: 'r1', businessName: 'Corner Cafe', vertical: 'restaurant' },
      pack: restaurant,
      themes: themes(
        [theme('food_taste', 'Food taste and quality', 'PRAISE', 20)],
        [theme('service_speed', 'Slow service', 'ISSUE', 7)],
        30,
      ),
      totalFeedback: 30,
      pulse: NO_PULSE,
      recentlyDone: [],
    });

    const message = composeOwnerUpdate(insight, voiceFor(restaurant, 'Corner Cafe'));
    const packAction = restaurant.issueTaxonomy.find(
      (t) => t.key === 'service_speed',
    )?.action;

    expect(message.body).toContain('Corner Cafe');
    expect(message.body).toContain(packAction ?? '__missing__');
  });

  it('runs through the same code path for all seven verticals', () => {
    for (const pack of listPacks()) {
      const issue = pack.issueTaxonomy[0];
      const praise = pack.praiseTaxonomy[0];
      if (!issue || !praise) throw new Error(`${pack.id} has an empty taxonomy`);

      const insight = buildInsight({
        client: { id: 'x', businessName: 'Test Business', vertical: pack.id },
        pack,
        themes: themes(
          [theme(praise.key, praise.label, 'PRAISE', 9)],
          [theme(issue.key, issue.label, 'ISSUE', 6)],
          30,
        ),
        totalFeedback: 30,
        pulse: NO_PULSE,
        recentlyDone: [],
      });

      for (const message of composeOwnerMessages(insight, voiceFor(pack, 'Test Business'))) {
        expect(message.blocked, `${pack.id}/${message.type}`).toBe(false);
        expect(message.body.length, `${pack.id}/${message.type}`).toBeGreaterThan(30);
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('owner communication is held to the same safety rules', () => {
  const insight = clinicInsight();
  const voice = voiceFor();

  const guard = (text: string) =>
    checkDraft(text, {
      voice,
      sourceText: '',
      allowedContext: [],
      allowedNumbers: insightNumbers(insight),
      maxWords: 320,
    });

  it('refuses a review incentive in an owner message', () => {
    const result = guard(
      'Quick update: tell happy customers they get 10% off for leaving a 5 star review.',
    );
    expect(result.storable).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('incentive');
  });

  it('refuses rewarding a customer for changing a rating', () => {
    const result = guard(
      'Offer a free session to anyone who agrees to update their review.',
    );
    expect(result.storable).toBe(false);
  });

  it('refuses a figure the stored data does not support', () => {
    const result = guard('Quick update: complaints fell by 42 this period.');
    expect(result.storable).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('invented_number');
  });

  it('allows a figure the insight does contain', () => {
    const result = guard('Quick update: waiting time was mentioned 9 times.');
    expect(result.problems.map((p) => p.code)).not.toContain('invented_number');
  });

  it('refuses customer contact details', () => {
    const result = guard('One customer left their number, 9876543210, please call them.');
    expect(result.storable).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('pii');
  });

  it('refuses a medical claim in a clinic update', () => {
    const result = guard('Patients report the treatment will cure them completely.');
    expect(result.storable).toBe(false);
  });

  it('refuses confirming a named patient detail', () => {
    const result = guard('Two patients mentioned your diagnosis was wrong on the day.');
    expect(result.storable).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('medical');
  });

  it('refuses an invented refund or compensation offer', () => {
    expect(guard('Tell them we will refund the amount in full.').storable).toBe(false);
    expect(guard('We will compensate every customer who waited.').storable).toBe(false);
  });

  it('refuses internal terminology leaking to the owner', () => {
    const result = guard('The sentiment analysis classified 9 reviews as negative.');
    expect(result.storable).toBe(false);
    expect(result.problems.map((p) => p.code)).toContain('internal');
  });

  it('refuses a link', () => {
    expect(guard('Full details at https://example.com/report for you.').storable).toBe(
      false,
    );
  });

  it('passes everything RepOS actually composes', () => {
    for (const pack of listPacks()) {
      const issue = pack.issueTaxonomy[0];
      const praise = pack.praiseTaxonomy[0];
      if (!issue || !praise) continue;

      const packInsight = buildInsight({
        client: { id: 'x', businessName: 'Test Business', vertical: pack.id },
        pack,
        themes: themes(
          [theme(praise.key, praise.label, 'PRAISE', 9)],
          [theme(issue.key, issue.label, 'ISSUE', 6)],
          30,
        ),
        totalFeedback: 30,
        pulse: WITH_PULSE,
        recentlyDone: [],
      });

      for (const language of ['ENGLISH', 'HINDI', 'HINGLISH', 'MARATHI'] as LanguageMix[]) {
        const messages = composeOwnerMessages(
          packInsight,
          inLanguage(voiceFor(pack, 'Test Business'), language),
        );
        for (const message of messages) {
          expect(
            message.problems.filter((p) => p.blocking),
            `${pack.id}/${language}/${message.type}: ${JSON.stringify(message.problems)}`,
          ).toEqual([]);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------

describe('composition needs no provider at all', () => {
  it('produces every message with AI switched off', () => {
    const previousKey = process.env.GROQ_API_KEY;
    const previousFlag = process.env.REPOS_AI_DISABLED;
    delete process.env.GROQ_API_KEY;
    process.env.REPOS_AI_DISABLED = '1';

    try {
      const messages = composeOwnerMessages(clinicInsight(), voiceFor());
      expect(messages.length).toBe(3);
      for (const message of messages) {
        expect(message.body.length).toBeGreaterThan(30);
        expect(message.blocked).toBe(false);
      }
    } finally {
      if (previousKey === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = previousKey;
      if (previousFlag === undefined) delete process.env.REPOS_AI_DISABLED;
      else process.env.REPOS_AI_DISABLED = previousFlag;
    }
  });

  it('is synchronous, so there is no call to fail', () => {
    // Composition returns a value, not a promise: there is no provider in this
    // path at all, which is a stronger guarantee than a fallback.
    const result = composeOwnerUpdate(clinicInsight(), voiceFor());
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result.body).toBe('string');
  });

  it('never mentions a model, a provider or a token', () => {
    for (const message of composeOwnerMessages(clinicInsight(), voiceFor())) {
      expect(`${message.body} ${message.notes.join(' ')}`).not.toMatch(
        /token|inference|provider|model|prompt|groq|openai/i,
      );
    }
  });
});

// ---------------------------------------------------------------------------

describe('numbers allowed in an owner message', () => {
  it('includes every count the insight actually holds', () => {
    const insight: OwnerInsight = clinicInsight();
    const allowed = insightNumbers(insight);

    expect(allowed.has('28')).toBe(true);
    expect(allowed.has('9')).toBe(true);
    expect(allowed.has('50')).toBe(true);
    expect(allowed.has('4242')).toBe(false);
  });
});
