/**
 * THE CORNER CAFE STORY — the Headway demo, as a dataset.
 *
 * Synthetic demo data for product evaluation. No real customer wrote any of
 * it, no real business is described, and nothing here was fetched from
 * anywhere. Every record is shaped exactly the way the product would have
 * stored it had it arrived through the real doors:
 *
 *   PUBLIC_REVIEW  a review the operator observed on a public listing and
 *                  pasted in: a star rating (sometimes none), a date, words.
 *                  No structured answers, because a public listing asks none.
 *   REP_OS_QR      a customer who scanned the table card: an overall rating,
 *                  a rating for each part of the visit the restaurant pack
 *                  asks about, the specifics they tapped when a rating was 3
 *                  or below, and — for some of them — a line or two of words.
 *                  Some wrote nothing at all. That is what the form collects.
 *
 * The story it tells, read in date order:
 *
 *   May–June      a well-liked neighbourhood cafe. Food praised constantly,
 *                 staff warm, value good — and a wait problem, mostly on
 *                 weekends, that keeps surfacing.
 *   27 June       first check-in. Slow service is the clearest complaint.
 *   21–25 July    the owner talks it through, says weekends are the crunch,
 *                 rules out discounts, and agrees to add a second server.
 *   1 August      the change is made. The table cards go out the same week,
 *                 so first-party feedback starts arriving through the QR.
 *   August        the wait complaints do not ease; they come up more. Wrong
 *                 and missing orders start creeping in alongside them.
 *   28 August     second check-in. Slow service and wrong orders both rose.
 *   1 September   Headway compares before and after: mentioned MORE often
 *                 after the change. The owner's note: the delay is in the
 *                 kitchen, not on the floor.
 *
 * Wording is deliberately varied — different people, different visits,
 * different lengths, three languages where that is realistic — and each text
 * was written against the restaurant pack's own vocabulary, so the reading is
 * deterministic and reproducible.
 */

export type PublicReview = {
  /** When the customer left it. ISO 8601 with an offset. Empty inside a check-in. */
  at: string;
  /** 1–5, or null where the listing showed none. */
  stars: number | null;
  text: string;
};

export type QrSubmission = {
  at: string;
  stars: number | null;
  /** Dimension key → 1–5, keys from the restaurant pack's gateway block. */
  dimensions: Record<string, number>;
  /** Signal keys the customer tapped. Only ever offered for a rating of 3 or below. */
  signals: string[];
  /** Optional words. Empty is a real submission: taps only. */
  text: string;
};

export type Checkin = {
  label: string;
  capturedAt: string;
  rating: number;
  reviewCount: number;
  unansweredCount: number;
  reviewsPerWeek: number;
  daysSinceLastPost: number;
  photoRecencyDays: number;
  /** Reviews the operator observed on the day, one per line as they paste them. */
  reviews: PublicReview[];
};

export type OwnerContextLine = {
  at: string;
  kind: 'OPERATING' | 'FOCUS' | 'CONSTRAINT' | 'PRIORITY';
  text: string;
  themeKey?: string;
  constraintKey?: 'STAFF' | 'DISCOUNT' | 'PRICE' | 'SPEND';
};

export type CornerCafeStory = {
  businessName: string;
  vertical: 'restaurant';
  /** Public reviews pasted before the first check-in. */
  earlyReviews: PublicReview[];
  firstCheckin: Checkin;
  /** Public reviews pasted between the first check-in and the decision. */
  midReviews: PublicReview[];
  owner: {
    conversation: { at: string; title: string; body: string };
    context: OwnerContextLine[];
    answer: { at: string; themeKey: string; answer: string };
    followUp: { at: string; title: string; body: string };
    afterNote: { at: string; title: string; body: string };
  };
  action: {
    suggestedAt: string;
    decidedAt: string;
    description: string;
    doneAt: string;
    measuredAt: string;
    learning: string;
  };
  /** Public reviews pasted after the change. */
  lateReviews: PublicReview[];
  secondCheckin: Checkin;
  /** What came through the table card, from the week it went out. */
  qr: QrSubmission[];
};

const r = (at: string, stars: number | null, text: string): PublicReview => ({ at, stars, text });

export const CORNER_CAFE: CornerCafeStory = {
  businessName: 'Corner Cafe',
  vertical: 'restaurant',

  // --- May and June: the cafe as its regulars know it -----------------------
  earlyReviews: [
    r('2026-05-28T13:10:00+05:30', 5, 'The food was excellent and the biryani was outstanding. Will be back.'),
    r('2026-05-30T20:45:00+05:30', 4, 'Lovely ambience, slightly pricey but worth it.'),
    r('2026-06-01T21:30:00+05:30', 2, 'Waited 45 minutes for a main course on a weekday evening. Nobody apologised or checked on us.'),
    r('2026-06-02T14:05:00+05:30', null, 'Khana accha tha lekin service thodi slow thi.'),
    r('2026-06-04T11:20:00+05:30', 5, 'Lovely place. Do you do outdoor catering as well?'),
    r('2026-06-06T19:50:00+05:30', 4, 'Warm and welcoming staff, very polite.'),
    r('2026-06-08T21:10:00+05:30', 2, 'Service was very slow, nobody checked on us at all.'),
    r('2026-06-10T13:35:00+05:30', 5, 'Food was delicious and full of flavour, the paneer especially.'),
    r('2026-06-11T15:00:00+05:30', 1, 'Took forever to be served even though it was empty.'),
    r('2026-06-13T20:20:00+05:30', 2, 'Food was cold when it arrived at the table.'),
    r('2026-06-15T13:15:00+05:30', 4, 'Good value for money for the portion size.'),
    r('2026-06-17T20:40:00+05:30', 5, 'Nice cosy ambience for an evening out, and tasty food.'),
    r('2026-06-18T21:05:00+05:30', 3, 'Music was too loud to talk, otherwise fine.'),
    r('2026-06-19T20:30:00+05:30', 2, 'They brought the wrong order and forgot one dish entirely.'),
    r('2026-06-20T12:50:00+05:30', 5, 'Great food, we will definitely be back.'),
    r('2026-06-21T21:15:00+05:30', 3, 'Service charge added to the bill without telling us.'),
    r('2026-06-22T16:40:00+05:30', 4, 'Staff are lovely and the place is clean and neat.'),
    r('2026-06-23T21:40:00+05:30', 2, 'Slow service again, took ages to get the bill.'),
    r('2026-06-24T10:30:00+05:30', 5, 'Best coffee in Aundh and the sandwiches are fresh.'),
    r('2026-06-24T19:25:00+05:30', 4, 'Reasonable prices and friendly staff.'),
  ],

  firstCheckin: {
    label: 'Check-in — June',
    capturedAt: '2026-06-27T12:25:00+05:30',
    rating: 4.0,
    reviewCount: 210,
    unansweredCount: 60,
    reviewsPerWeek: 2.6,
    daysSinceLastPost: 25,
    photoRecencyDays: 50,
    reviews: [
      r('', 5, 'Food was delicious, the dal was full of flavour.'),
      r('', 2, 'Waited nearly an hour for mains on Saturday.'),
      r('', 4, 'Warm and friendly staff.'),
      r('', 5, 'Loved the food, authentic Maharashtrian thali.'),
      r('', 2, 'Slow service, we had to keep asking for water.'),
      r('', 4, 'Good value for money.'),
      r('', 1, 'Waited far too long to order and then the food was cold.'),
      r('', 5, 'Tasty food and a cosy place.'),
      r('', 2, 'They forgot our starters entirely.'),
      r('', 4, 'Very polite staff and great food.'),
      r('', 3, 'Good food, slow service.'),
      r('', 5, 'The biryani was outstanding.'),
      r('', 4, 'Peaceful spot for a coffee.'),
      r('', 3, 'Decent, nothing special.'),
    ],
  },

  // --- Late June to late July: the same picture, a little louder ------------
  midReviews: [
    r('2026-06-29T20:55:00+05:30', 2, 'Waited 40 minutes for a main course on a quiet evening.'),
    r('2026-07-02T13:20:00+05:30', 5, 'Food was tasty and the portions were generous.'),
    r('2026-07-05T21:35:00+05:30', 2, 'Slow service on Friday night, over an hour for mains.'),
    r('2026-07-08T16:10:00+05:30', 4, 'Friendly staff and a peaceful place to work from in the afternoon.'),
    r('2026-07-10T20:15:00+05:30', 1, 'Wrong order, and then we waited 30 minutes for the right one.'),
    r('2026-07-12T13:45:00+05:30', 5, 'Excellent food, the kadhai chicken is a must.'),
    r('2026-07-14T21:00:00+05:30', 3, 'Had to wait for a table even with a booking, and then waited again for the food.'),
    r('2026-07-17T13:05:00+05:30', 2, 'A fly in my soup and the table was not clean.'),
    r('2026-07-19T21:20:00+05:30', 2, 'Service was very slow, we waited nearly an hour for mains.'),
    r('2026-07-22T12:40:00+05:30', 4, 'Good food, worth the money.'),
  ],

  owner: {
    conversation: {
      at: '2026-07-21T11:00:00+05:30',
      title: 'Owner raised weekend kitchen delays',
      body: 'Owner says the kitchen is short-staffed on Friday and Saturday evenings and is considering a second server on the floor.',
    },
    context: [
      {
        at: '2026-07-21T11:05:00+05:30',
        kind: 'OPERATING',
        text: 'Friday and Saturday evenings are much busier than other days',
        themeKey: 'service_speed',
      },
      {
        at: '2026-07-21T11:06:00+05:30',
        kind: 'FOCUS',
        text: 'Slow service is my biggest concern right now',
        themeKey: 'service_speed',
      },
      {
        at: '2026-07-21T11:08:00+05:30',
        kind: 'CONSTRAINT',
        text: 'Do not recommend discounts or offers',
        constraintKey: 'DISCOUNT',
      },
    ],
    answer: { at: '2026-07-25T13:00:00+05:30', themeKey: 'service_speed', answer: 'Weekend evenings' },
    followUp: {
      at: '2026-07-27T10:00:00+05:30',
      title: 'Check whether the second server was hired',
      body: 'Agreed to revisit staffing at the next monthly call.',
    },
    afterNote: {
      at: '2026-09-01T18:30:00+05:30',
      title: 'Kitchen ticket-time target agreed with owner',
      body: 'Owner will post a target time per course in the kitchen and track any table waiting past it.',
    },
  },

  action: {
    suggestedAt: '2026-07-23T12:25:00+05:30',
    decidedAt: '2026-07-25T12:25:00+05:30',
    description: 'Added a second server on Friday and Saturday evenings',
    doneAt: '2026-08-01T12:25:00+05:30',
    measuredAt: '2026-09-01T12:25:00+05:30',
    learning:
      'The extra server helped at the door but the delay is in the kitchen, not the floor. Needs a different fix.',
  },

  // --- August: after the change ----------------------------------------------
  lateReviews: [
    r('2026-08-03T21:30:00+05:30', 2, 'Waited 50 minutes for a table and then another 30 for the mains on Saturday. The food is good but not good enough to justify that.'),
    r('2026-08-06T20:10:00+05:30', 5, 'Loved the food, especially the kadhai paneer. Staff were warm and welcoming.'),
    r('2026-08-09T14:20:00+05:30', 2, 'Slow service on a Sunday lunch, 40 minutes for starters.'),
    r('2026-08-12T20:45:00+05:30', 4, 'Good value for money and a cosy place for a quiet dinner.'),
    r('2026-08-16T21:25:00+05:30', 1, 'They forgot half our order and the rest came late. Second bad visit in a row.'),
    r('2026-08-19T21:00:00+05:30', 5, 'Delicious food and the ambience was lovely for a date night.'),
    r('2026-08-22T13:30:00+05:30', 3, 'Food was tasty but the service was very slow, waited a long time to even order.'),
    r('2026-08-26T20:50:00+05:30', null, 'Wrong order brought to our table and no apology. Waited ages for the right one.'),
  ],

  secondCheckin: {
    label: 'Check-in — August',
    capturedAt: '2026-08-28T12:25:00+05:30',
    rating: 3.6,
    reviewCount: 244,
    unansweredCount: 88,
    reviewsPerWeek: 3.1,
    daysSinceLastPost: 30,
    photoRecencyDays: 60,
    reviews: [
      r('', 2, 'Very slow service on Friday evening, nearly an hour for the mains.'),
      r('', 5, 'Excellent food, the mutton curry was full of flavour.'),
      r('', 2, 'Took forever to get the bill, and they brought the wrong order before that.'),
      r('', 4, 'Warm, polite staff and a cosy atmosphere.'),
      r('', 1, 'Waited 45 minutes and then the food arrived cold.'),
      r('', 3, 'Tasty food but slow, especially on weekends.'),
      r('', 5, 'Great food and generous portions, worth every rupee.'),
      r('', 2, 'Missing items from our order again. Third time.'),
      r('', 4, 'The staff were very friendly and helpful.'),
      r('', 2, 'Overpriced for the portion size now, and we still waited 30 minutes.'),
      r('', 3, 'Tables were sticky and the washroom was dirty, though the food was good.'),
      r('', 5, 'Delicious biryani, we come every month.'),
      r('', 2, 'Slow service and they forgot our drinks entirely.'),
    ],
  },

  // --- The table card: what customers sent straight to the team ------------
  qr: [
    {
      at: '2026-08-02T21:40:00+05:30',
      stars: 4,
      dimensions: { food: 5, service: 4, waiting: 3, cleanliness: 5, value: 4 },
      signals: ['for_food'],
      text: 'The paneer tikka was delicious and the staff were friendly. We waited a good twenty minutes for the mains on Saturday.',
    },
    {
      at: '2026-08-03T13:55:00+05:30',
      stars: 5,
      dimensions: { food: 5, service: 5, waiting: 4, cleanliness: 5, value: 5 },
      signals: [],
      text: '',
    },
    {
      at: '2026-08-05T22:05:00+05:30',
      stars: 2,
      dimensions: { food: 4, service: 2, waiting: 1, value: 3 },
      signals: ['hard_to_find', 'to_order', 'for_food', 'portion_price'],
      text: 'Waited forty minutes for two mains on a Friday night, and it was hard to find anyone to ask. The food was good when it finally arrived.',
    },
    {
      at: '2026-08-07T20:30:00+05:30',
      stars: 5,
      dimensions: { food: 5, waiting: 4, value: 5 },
      signals: [],
      text: 'The biryani was outstanding. Generous portions and very reasonable for what you get.',
    },
    {
      at: '2026-08-08T21:15:00+05:30',
      stars: 3,
      dimensions: { food: 3, service: 4, waiting: 2 },
      signals: ['not_hot', 'for_food'],
      text: 'Food came cold and we waited far too long for it. Staff were polite about it though.',
    },
    {
      at: '2026-08-09T13:20:00+05:30',
      stars: 4,
      dimensions: {},
      signals: [],
      text: '',
    },
    {
      at: '2026-08-10T14:45:00+05:30',
      stars: 2,
      dimensions: { food: 4, service: 3, waiting: 2, cleanliness: 4, value: 3 },
      signals: ['order_wrong', 'for_food', 'portion_price'],
      text: 'Order galat aaya aur phir sahi wala aane me kaafi der lagi. Khana accha tha lekin Sunday lunch me itna wait theek nahi.',
    },
    {
      at: '2026-08-12T13:40:00+05:30',
      stars: 5,
      dimensions: { food: 5, service: 5, waiting: 5, cleanliness: 5, value: 4 },
      signals: [],
      text: 'Quiet weekday lunch. Everything came out quickly and the dal makhani was really tasty.',
    },
    {
      at: '2026-08-14T22:20:00+05:30',
      stars: 1,
      dimensions: { food: 2, service: 2, waiting: 1, value: 2 },
      signals: ['taste', 'not_hot', 'manner', 'for_food', 'for_bill', 'too_high'],
      text: 'Terrible evening. Waited nearly an hour, the food was bland and cold, and the bill took another twenty minutes. Not coming back.',
    },
    {
      at: '2026-08-15T20:10:00+05:30',
      stars: 4,
      dimensions: { food: 4, service: 4, waiting: 4, cleanliness: 3, value: 4 },
      signals: ['washroom'],
      text: '',
    },
    {
      at: '2026-08-16T22:00:00+05:30',
      stars: 3,
      dimensions: { food: 5, waiting: 2, value: 4 },
      signals: ['for_table', 'for_food'],
      text: 'Full of flavour as always, but on Saturday night there was a queue at the door and then we waited ages for the food. Worth it, just plan for it.',
    },
    {
      at: '2026-08-18T20:35:00+05:30',
      stars: 5,
      dimensions: { food: 5, service: 5, waiting: 5 },
      signals: [],
      text: 'टीम खूप आपुलकीने वागली आणि जेवण चवदार होतं.',
    },
    {
      at: '2026-08-19T21:10:00+05:30',
      stars: 2,
      dimensions: { service: 2, waiting: 3 },
      signals: ['order_wrong', 'hard_to_find', 'to_order'],
      text: 'We ordered three starters and two never came. When we asked, the server said the ticket was missing. Not what I expect on a Tuesday when it is half empty.',
    },
    {
      at: '2026-08-21T19:45:00+05:30',
      stars: 4,
      dimensions: { food: 4, value: 5 },
      signals: [],
      text: 'Very affordable for a family dinner and the kids loved the pizza.',
    },
    {
      at: '2026-08-22T21:50:00+05:30',
      stars: 3,
      dimensions: {},
      signals: [],
      text: 'Service is slow on weekends, please fix.',
    },
    {
      at: '2026-08-23T14:30:00+05:30',
      stars: 2,
      dimensions: { food: 3, service: 2, waiting: 2, value: 2 },
      signals: ['portion', 'order_wrong', 'for_food', 'portion_price'],
      text: 'Wrong order twice in one visit, and we waited 35 minutes for the correction. Portions have also got smaller for the price.',
    },
    {
      at: '2026-08-27T20:25:00+05:30',
      stars: 4,
      dimensions: { food: 5, service: 3, waiting: 4 },
      signals: ['rushed'],
      text: 'Delicious thali. Felt a bit rushed at the end when they wanted the table back, but no complaints about the food.',
    },
    {
      at: '2026-08-29T21:55:00+05:30',
      stars: 3,
      dimensions: { waiting: 2 },
      signals: ['for_bill'],
      text: 'Twenty minutes just for the bill after a nice meal.',
    },
    {
      at: '2026-08-31T20:40:00+05:30',
      stars: 2,
      dimensions: { food: 4, service: 1, waiting: 1 },
      signals: ['hard_to_find', 'order_wrong', 'to_order', 'for_food'],
      text: 'Sunday evening: 15 minutes before anyone took our order, then the wrong order arrived, then another long delay. The kitchen clearly cannot keep up when it is full.',
    },
    {
      at: '2026-09-03T13:25:00+05:30',
      stars: 5,
      dimensions: { food: 5, service: 5, waiting: 4, cleanliness: 5, value: 4 },
      signals: [],
      text: 'Fresh, tasty, and the place was clean and neat. We will be back.',
    },
    {
      at: '2026-09-05T19:56:00+05:30',
      stars: 4,
      dimensions: { food: 3, service: 2, waiting: 5, cleanliness: 5, value: 3 },
      signals: ['not_fresh', 'hard_to_find', 'portion_price'],
      text: 'Improve service',
    },
    {
      at: '2026-09-06T21:05:00+05:30',
      stars: 4,
      dimensions: { food: 4, service: 4, waiting: 3, value: 4 },
      signals: ['for_food'],
      text: '',
    },
  ],
};

/** Every piece of feedback in the story, in the order it arrives. */
export function storyFeedbackCount(story: CornerCafeStory = CORNER_CAFE): number {
  return (
    story.earlyReviews.length +
    story.firstCheckin.reviews.length +
    story.midReviews.length +
    story.lateReviews.length +
    story.secondCheckin.reviews.length +
    story.qr.length
  );
}
