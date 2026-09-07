import type { Quote } from '@/lib/portal/evidence';
import type { FocusProof, ProofPopulation } from '@/lib/portal/focus';

/**
 * THE DEMO BUSINESS, AS THE PRODUCT SHOWS IT.
 *
 * Corner Cafe is Headway's demonstration dataset — `scripts/demo/corner-cafe.ts`,
 * 87 pieces of synthetic feedback that tell one story: a well-liked cafe with
 * a wait problem, an owner who adds a second server, and a measurement that
 * says the complaint came up MORE afterwards. No real customer wrote any of
 * it and no real business is described, which is exactly why the website may
 * show it: nothing here is anyone's data.
 *
 * Every figure below is what the product's own engines rendered for that
 * dataset — the Home block, the signal board, the improvement story — and
 * the website repeats them rather than restating them. It computes nothing
 * and rounds nothing; where a sentence appears here it is the engine's
 * sentence. `tests/m26.marketing-site.test.ts` holds this file to the
 * dataset: every quotation is a verbatim line from it, every date is one it
 * carries, and the arithmetic that can be checked from the raw records is.
 */

export const DEMO_BUSINESS = {
  name: 'Corner Cafe',
  verticalLabel: 'Restaurant / Cafe',
  /** Every piece of feedback in the story, counted by the dataset itself. */
  total: 87,
} as const;

const IST = '+05:30';
const at = (iso: string): Date => new Date(`${iso}${IST}`);

function quote(
  id: string,
  text: string,
  stars: number | null,
  when: string,
  source: 'REP_OS_QR' | 'PUBLIC_REVIEW',
): Quote {
  return {
    id,
    text,
    stars,
    at: at(when),
    source,
    sourceLabel: source === 'REP_OS_QR' ? 'Feedback QR' : 'Public review',
  };
}

/** The three the product quotes under "39% of feedback". */
export const SLOW_SERVICE_QUOTES: Quote[] = [
  quote(
    'q-0831',
    'Sunday evening: 15 minutes before anyone took our order, then the wrong order arrived, then another long delay. The kitchen clearly cannot keep up when it is full.',
    2,
    '2026-08-31T20:40:00',
    'REP_OS_QR',
  ),
  quote(
    'q-0828a',
    'Very slow service on Friday evening, nearly an hour for the mains.',
    2,
    '2026-08-28T12:25:00',
    'PUBLIC_REVIEW',
  ),
  quote(
    'q-0828b',
    'Took forever to get the bill, and they brought the wrong order before that.',
    2,
    '2026-08-28T12:25:00',
    'PUBLIC_REVIEW',
  ),
];

/** The three the product quotes under the strength. */
export const FOOD_PRAISE_QUOTES: Quote[] = [
  quote(
    'p-0903',
    'Fresh, tasty, and the place was clean and neat. We will be back.',
    5,
    '2026-09-03T13:25:00',
    'REP_OS_QR',
  ),
  quote(
    'p-0828',
    'Excellent food, the mutton curry was full of flavour.',
    5,
    '2026-08-28T12:25:00',
    'PUBLIC_REVIEW',
  ),
  quote('p-0818', 'टीम खूप आपुलकीने वागली आणि जेवण चवदार होतं.', 5, '2026-08-18T20:35:00', 'REP_OS_QR'),
];

export const CAVEAT =
  'This compares feedback before and after the change. It cannot show that the change caused the difference — nothing Headway can see would prove that.';

/** The before/after the measurement engine froze on 1 September. */
export const MEASUREMENT = {
  before: { count: 14, total: 44, share: '32%', scope: 'Feedback read up to 23 Jul 2026' },
  after: { count: 20, total: 43, share: '47%', scope: 'Feedback after the change, recorded 01 Aug 2026' },
  reading: 'More often after the change',
  why: [
    'Slow service was 14 of 44 reviews (32%) everything read up to 23 Jul 2026, when the action was agreed. It is 20 of 43 reviews (47%) in the feedback that has come in since the change on 1 Aug 2026.',
    'The share moved by 15%, past the 5% Headway needs before calling a direction.',
  ],
  changeDate: at('2026-08-01T12:25:00'),
} as const;

/** The two piles, in the shape the product's own before/after component draws. */
export const POPULATION: ProofPopulation = {
  before: { ...MEASUREMENT.before },
  after: { ...MEASUREMENT.after },
  reading: MEASUREMENT.reading,
  tone: 'bad',
  why: [...MEASUREMENT.why],
  caveat: CAVEAT,
  changeDate: MEASUREMENT.changeDate,
};

/**
 * The Home block — RIGHT NOW, WHY, three proofs, WHAT TO DO, and what Headway
 * checks next — exactly as `buildFocus` produced it for Corner Cafe.
 */
export const RIGHT_NOW = {
  basis: 'Based on 87 pieces of feedback we have read.',
  direction: { value: 'Needs attention', scope: 'Compared with your previous check-in' },
  headline: 'Slow service is the one thing worth your attention.',
  why: 'Customers are not unhappy about your food taste and quality — 32 praised it. What they keep raising is slow service, and it has come up more since your change.',
  next: {
    headline: 'Check what else changed before undoing anything.',
    detail:
      'The original suggestion still stands: Set a target ticket time per course and post it in the kitchen; assign one person to track tables waiting over that time.',
    cta: 'See everything on slow service',
    watching:
      'Headway is checking whether slow service comes up more or less at your next check-in, and will flag a move of 2 or more mentions.',
  },
  watching: {
    label: 'Wrong or missing items came up more at your latest check-in.',
    count: '12 of 87',
  },
  goingWell: {
    label: 'Customers consistently praise your food taste and quality.',
    count: '32 of 87',
  },
} as const;

/** The three chips under the decision, in the product's own order and words. */
export const PROOFS: FocusProof[] = [
  {
    key: 'share',
    label: '39% of feedback',
    detail: '34 of the 87 pieces of feedback Headway has read mention it.',
    tone: 'bad',
    quotes: SLOW_SERVICE_QUOTES,
    seeAll: null,
    population: null,
    comparison: null,
  },
  {
    key: 'outcome',
    label: 'More often after your change',
    detail: '32% of feedback before the change, 47% after.',
    tone: 'bad',
    quotes: [],
    seeAll: null,
    population: POPULATION,
    comparison: null,
  },
  {
    key: 'recurrence',
    label: 'At both recent check-ins',
    detail: 'Raised at 2 of your last 2 check-ins.',
    tone: 'bad',
    quotes: [],
    seeAll: null,
    population: null,
    comparison: null,
  },
];

/**
 * What customers tapped on the feedback page, added up — the "Waiting" rating
 * across every table-card submission that rated it.
 */
export const TAPPED = {
  label: 'Waiting',
  rated: 19,
  average: '3.0',
  low: 11,
  specifics: [
    { label: 'For the food', count: 9 },
    { label: 'To place the order', count: 3 },
    { label: 'For the bill', count: 2 },
    { label: 'For a table', count: 1 },
  ],
} as const;

/** The leading complaint, as the signal board reads it. */
export const SLOW_SERVICE = {
  label: 'Slow service',
  count: 34,
  share: '39%',
  trend: 'increasing',
  outcome: 'more often after your change',
  meaning:
    'In the feedback after your change on 01 Aug 2026 it has come up more often (32% of feedback before, 47% after). This does not show the change caused the difference. Worth looking at again.',
  suggestion:
    'Set a target ticket time per course and post it in the kitchen; assign one person to track tables waiting over that time.',
  whatToDo:
    'It came up more often in the feedback after the change. That does not show the change caused it — before undoing anything, check what else changed.',
  why: 'This is a serious complaint for a restaurant.',
  source: '34 of the 87 pieces of feedback Headway has read',
  recurrence: 'Raised at 2 of your last 2 check-ins.',
  checkins: { june: 9, august: 24 },
} as const;

/** The four kinds of signal, each with the Corner Cafe example the board shows. */
export const SIGNALS = {
  loved: { label: 'Food taste and quality', count: 32, share: '37%', movement: 'growing', chip: 'Protect' },
  unhappy: { label: 'Slow service', count: 34, share: '39%', movement: 'increasing', chip: 'Needs you' },
  changing: {
    label: 'Wrong or missing items',
    count: 12,
    share: '14%',
    checkins: { june: 2, august: 9 },
    line: 'Customers raised it more at your latest check-in than at the one before, so it is becoming more prominent.',
    chip: 'Watching',
  },
  attention: {
    headline: 'Slow service is the one thing worth your attention.',
    chip: 'Needs you',
  },
} as const;

/** The improvement story, in the owner's own dates. */
export const IMPROVEMENT = {
  about: 'Slow service',
  suggestedAt: at('2026-07-23T12:25:00'),
  suggested: SLOW_SERVICE.suggestion,
  decidedAt: at('2026-07-25T12:25:00'),
  decision: 'Added a second server on Friday and Saturday evenings',
  doneAt: at('2026-08-01T12:25:00'),
  measuredAt: at('2026-09-01T12:25:00'),
  whatHappened: 'More often after the change',
  whatItMeans: 'Customers are mentioning slow service more often since the change.',
  whatToDoNow: 'Check what else changed before undoing anything.',
  learning:
    'The extra server helped at the door but the delay is in the kitchen, not the floor. Needs a different fix.',
  watching: RIGHT_NOW.next.watching,
} as const;

/**
 * What the pile looks like before anyone reads it: eight pieces of feedback
 * as they arrived, in three languages, one of them a rating with no words at
 * all. Every line is a record from the dataset.
 */
export type PileItem =
  | { kind: 'words'; text: string; stars: number | null; source: 'Feedback QR' | 'Public review' }
  | { kind: 'taps'; stars: number; parts: Array<{ label: string; value: number }>; specifics: string[] };

export const PILE: PileItem[] = [
  { kind: 'words', text: 'Khana accha tha lekin service thodi slow thi.', stars: null, source: 'Public review' },
  { kind: 'words', text: 'Best coffee in Aundh and the sandwiches are fresh.', stars: 5, source: 'Public review' },
  {
    kind: 'words',
    text: 'Waited 45 minutes for a main course on a weekday evening. Nobody apologised or checked on us.',
    stars: 2,
    source: 'Public review',
  },
  {
    kind: 'taps',
    stars: 4,
    parts: [
      { label: 'Food and drink', value: 4 },
      { label: 'Service', value: 4 },
      { label: 'Waiting', value: 3 },
      { label: 'Value for money', value: 4 },
    ],
    specifics: ['For the food'],
  },
  { kind: 'words', text: 'Lovely place. Do you do outdoor catering as well?', stars: 5, source: 'Public review' },
  { kind: 'words', text: 'टीम खूप आपुलकीने वागली आणि जेवण चवदार होतं.', stars: 5, source: 'Feedback QR' },
  {
    kind: 'words',
    text: 'Order galat aaya aur phir sahi wala aane me kaafi der lagi. Khana accha tha lekin Sunday lunch me itna wait theek nahi.',
    stars: 2,
    source: 'Feedback QR',
  },
  { kind: 'words', text: 'Twenty minutes just for the bill after a nice meal.', stars: 3, source: 'Feedback QR' },
];

/** The Customers page's opening, as rendered. */
export const IN_SHORT = {
  strengths:
    'Customers most consistently value your food taste and quality, though 5 said the opposite. Warm, welcoming staff, good value for money and ambience and decor are praised often too.',
  shortfall: 'Slow service is where the experience falls short most often.',
} as const;
