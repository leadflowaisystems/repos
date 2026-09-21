import type { DemoStory, PublicReview } from '../story';

/**
 * EVERAFTER WEDDINGS — the wedding vendor demo.
 *
 * Synthetic demo data for product evaluation. A fictional wedding decor and
 * planning studio; no real couple, family, planner or business.
 *
 *   June–July    couples love the decor and the calm team on the day. What
 *                keeps coming up is the months before: no updates, messages
 *                ignored, plans changed without telling anyone.
 *   8 July       first check-in. Communication is the clearest complaint; the
 *                setup crew running late is second.
 *   24–29 July   the owner says each wedding passes between sales, design and
 *                the on-site team; they agree one coordinator per wedding.
 *   3 August     one named coordinator from booking to event day, and a fixed
 *                weekly update call. The QR card goes into the thank-you box
 *                the same week.
 *   Aug–Sept     the crew is on time now. Communication does not improve: the
 *                weekly calls slip, and couples still chase for answers.
 *   9 September  second check-in: communication up, lateness gone.
 *   12 September Headway compares before and after: communication mentioned
 *                MORE often after the change. The gap is the handover between
 *                the coordinator and the decor team, not the number of calls.
 */

const r = (at: string, stars: number | null, text: string): PublicReview => ({ at, stars, text });

export const EVERAFTER_WEDDINGS: DemoStory = {
  businessName: 'EverAfter Weddings',
  vertical: 'wedding_vendor',

  earlyReviews: [
    r('2026-06-06T20:10:00+05:30', 5, 'The decor was stunning, every guest asked who did the mandap.'),
    r('2026-06-09T13:30:00+05:30', 2, 'Booked them in April and got no updates for weeks. We had to keep calling to find out anything.'),
    r('2026-06-12T18:45:00+05:30', 4, 'Beautiful work on the day and a calm, professional team.'),
    r('2026-06-15T11:20:00+05:30', 3, 'Lovely flowers, but the team came late to set up for the haldi.'),
    r('2026-06-18T19:05:00+05:30', 2, 'Messages about the theme went unanswered and my calls were ignored.'),
    r('2026-06-21T12:40:00+05:30', 5, 'Excellent work and very well managed on the wedding day.'),
    r('2026-06-24T17:15:00+05:30', null, 'Kaam accha tha, but planning ke time pe phone not picked up, koi jawab nahi milta tha.'),
    r('2026-06-27T16:30:00+05:30', 4, 'Flexible with our last minute changes and the stage looked lovely.'),
    r('2026-06-30T20:20:00+05:30', 2, 'Hard to reach before the event. Nobody told us the colour scheme had changed.'),
    r('2026-07-04T14:00:00+05:30', 5, 'Stunning decor, smooth coordination on the day.'),
  ],

  firstCheckin: {
    label: 'Check-in — July',
    capturedAt: '2026-07-08T11:00:00+05:30',
    rating: 4.6,
    reviewCount: 64,
    unansweredCount: 22,
    reviewsPerWeek: 0.9,
    daysSinceLastPost: 18,
    photoRecencyDays: 25,
    reviews: [
      r('', 5, 'Beautiful decor and a polite team.'),
      r('', 2, 'No response to emails for two weeks before the wedding.'),
      r('', 3, 'Great work but the setup crew came late.'),
      r('', 4, 'Stunning mandap, very professional.'),
      r('', 2, 'Hard to reach and plans changed without telling us.'),
      r('', 3, 'Nice work, but no updates on timings and they arrived late for the sangeet.'),
      r('', 5, 'Excellent work, worth every rupee.'),
      r('', 3, 'Setup was not on time and the florist came late.'),
    ],
  },

  midReviews: [
    r('2026-07-11T19:00:00+05:30', 2, 'Our coordinator ignored three messages about the guest count.'),
    r('2026-07-14T13:15:00+05:30', 5, 'The decor was beautiful and the team handled the rain perfectly.'),
    r('2026-07-17T18:20:00+05:30', 2, 'No updates at all in the final week. Very stressful for the family.'),
    r('2026-07-20T12:05:00+05:30', 4, 'Amazing photos of the decor, and they adjusted everything we asked.'),
    r('2026-07-23T20:40:00+05:30', 3, 'Good decor, but hard to reach anyone after the advance was paid.'),
    r('2026-07-25T15:30:00+05:30', 3, 'They asked more for extra lighting on the day.'),
  ],

  owner: {
    conversation: {
      at: '2026-07-24T16:00:00+05:30',
      title: 'Owner raised couples chasing for updates',
      body: 'Owner says each wedding passes from sales to design to the on-site team, and couples do not know who to ask at each stage.',
    },
    context: [
      {
        at: '2026-07-24T16:05:00+05:30',
        kind: 'OPERATING',
        text: 'Couples usually book four to six months ahead, and most of the contact happens in the last month',
        themeKey: 'communication',
      },
      {
        at: '2026-07-24T16:06:00+05:30',
        kind: 'FOCUS',
        text: 'Couples feeling ignored before the wedding is my biggest worry',
        themeKey: 'communication',
      },
      {
        at: '2026-07-24T16:08:00+05:30',
        kind: 'CONSTRAINT',
        text: 'Do not suggest discounts to make up for it',
        constraintKey: 'DISCOUNT',
      },
    ],
    followUp: {
      at: '2026-07-31T16:00:00+05:30',
      title: 'Check the coordinator model after the August weddings',
      body: 'Agreed to review how the weekly calls went once the August weddings are done.',
    },
    afterNote: {
      at: '2026-09-12T19:00:00+05:30',
      title: 'Written handover between coordinator and decor team',
      body: 'Owner will have the coordinator send the couple a written summary after every design change, instead of relying on the weekly call.',
    },
  },

  action: {
    suggestedAt: '2026-07-27T11:00:00+05:30',
    decidedAt: '2026-07-29T11:00:00+05:30',
    description: 'One named coordinator for each wedding from booking to event day, with a fixed weekly update call',
    doneAt: '2026-08-03T09:00:00+05:30',
    measuredAt: '2026-09-12T11:00:00+05:30',
    learning:
      'Communication came up more often after the coordinator change. The weekly calls slip, and design changes still reach couples late. Needs a written handover.',
  },

  lateReviews: [
    r('2026-08-08T20:30:00+05:30', 5, 'Stunning work and a very calm team.'),
    r('2026-08-14T12:45:00+05:30', 2, 'The coordinator changed twice and nobody told us. No response to our questions for days.'),
    r('2026-08-20T19:10:00+05:30', 4, 'Beautiful decor, on time and professional.'),
    r('2026-08-26T16:00:00+05:30', 2, 'The weekly call was called off twice. Hard to reach the decor team directly.'),
    r('2026-09-01T13:25:00+05:30', 3, 'Great work on the day, but we were ignored in the planning stage.'),
    r('2026-09-07T18:40:00+05:30', 2, 'No updates on the stage design until two days before.'),
    r('2026-09-14T11:50:00+05:30', 4, 'Excellent work, though an additional charge for transport appeared on the bill.'),
  ],

  secondCheckin: {
    label: 'Check-in — September',
    capturedAt: '2026-09-09T11:00:00+05:30',
    rating: 4.4,
    reviewCount: 71,
    unansweredCount: 18,
    reviewsPerWeek: 1.1,
    daysSinceLastPost: 9,
    photoRecencyDays: 11,
    reviews: [
      r('', 5, 'Stunning decor, polite and professional team.'),
      r('', 2, 'No response on WhatsApp for a week.'),
      r('', 3, 'Beautiful work but so hard to reach before the event.'),
      r('', 2, 'Ignored our calls about the stall layout.'),
      r('', 4, 'Arrived early and the setup was ready on time.'),
      r('', 2, 'No updates after the first meeting, we had to chase them.'),
      r('', 5, 'Excellent work and well managed.'),
      r('', 3, 'Good decor, but plans changed and no one told us. No response for days.'),
    ],
  },

  qr: [
    {
      at: '2026-08-05T21:00:00+05:30',
      stars: 5,
      dimensions: { quality: 5, communication: 5, punctuality: 5, team: 5, value: 5 },
      signals: ['stunning_work', 'professional', 'arrived_on_time'],
      text: '',
    },
    {
      at: '2026-08-09T13:40:00+05:30',
      stars: 3,
      dimensions: { quality: 5, communication: 2, punctuality: 4, team: 4, value: 4 },
      signals: ['chased', 'plans_changed', 'stunning_work'],
      text: 'Beautiful decor. Getting a reply was the hard part, no updates unless we chased.',
    },
    {
      at: '2026-08-13T18:25:00+05:30',
      stars: 5,
      dimensions: { quality: 5, communication: 5, punctuality: 5, team: 5, value: 5 },
      signals: ['matched_samples', 'worth_it'],
      text: 'Loved the stage, exactly like the samples.',
    },
    {
      at: '2026-08-17T12:10:00+05:30',
      stars: 2,
      dimensions: { quality: 4, communication: 1, punctuality: 4, team: 3, value: 4 },
      signals: ['no_reply', 'no_lead'],
      text: 'Nobody seemed in charge and our messages went unanswered. No response from the coordinator.',
    },
    {
      at: '2026-08-21T20:15:00+05:30',
      stars: 4,
      dimensions: {},
      signals: [],
      text: '',
    },
    {
      at: '2026-08-24T16:45:00+05:30',
      stars: 4,
      dimensions: { quality: 5, communication: 3, punctuality: 4, team: 4, value: 4 },
      signals: ['stunning_work', 'unclear_scope'],
      text: 'Great work, but it was never clear what was included.',
    },
    {
      at: '2026-08-28T19:30:00+05:30',
      stars: 2,
      dimensions: { quality: 4, communication: 2, punctuality: 4, team: 4, value: 3 },
      signals: ['plans_changed', 'not_included'],
      text: 'Hard to reach, and the plan changed without asking us.',
    },
    {
      at: '2026-09-01T11:15:00+05:30',
      stars: 5,
      dimensions: { quality: 5, communication: 4, punctuality: 5, team: 5, value: 4 },
      signals: ['captured_everything', 'promised_team', 'arrived_on_time'],
      text: '',
    },
    {
      at: '2026-09-04T17:50:00+05:30',
      stars: 3,
      dimensions: { quality: 4, communication: 2, punctuality: 4, team: 4, value: 4 },
      signals: ['chased'],
      text: 'Had to chase for everything, no updates otherwise.',
    },
    {
      at: '2026-09-08T20:05:00+05:30',
      stars: 5,
      dimensions: { quality: 5, communication: 5, punctuality: 5, team: 5, value: 5 },
      signals: ['stunning_work', 'well_led'],
      text: 'Stunning decor and a calm team on the day.',
    },
    {
      at: '2026-09-11T14:20:00+05:30',
      stars: 2,
      dimensions: { quality: 4, communication: 1, punctuality: 4, team: 4, value: 2 },
      signals: ['no_reply', 'extra_charges'],
      text: 'No response for a week, then an extra charge for flowers.',
    },
    {
      at: '2026-09-15T18:35:00+05:30',
      stars: 4,
      dimensions: { quality: 5, communication: 4, punctuality: 4, team: 4, value: 4 },
      signals: ['stunning_work', 'delivered_on_time'],
      text: 'Album delivered on time and the photos are beautiful.',
    },
    {
      at: '2026-09-18T12:00:00+05:30',
      stars: 3,
      dimensions: { quality: 4, communication: 2, punctuality: 4, team: 4, value: 4 },
      signals: ['chased'],
      text: 'Coordination is still the weak spot. We were ignored until the last week.',
    },
  ],
};
