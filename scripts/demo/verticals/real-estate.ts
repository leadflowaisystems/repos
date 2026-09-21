import type { DemoStory, PublicReview } from '../story';

/**
 * NESTORA PROPERTIES — the real estate demo.
 *
 * Synthetic demo data for product evaluation. A fictional rental and resale
 * advisory; no real client, agent, property, price or transaction. Feedback is
 * about the service — replies, visits, honesty, support — never about a
 * particular flat, a figure or a legal matter.
 *
 *   June–July    clients trust the team: honest, patient, know the area. What
 *                keeps coming up is follow-up — no callback, no response,
 *                messages ignored.
 *   9 July       first check-in. Slow responses are the clearest complaint;
 *                missed site visits come second.
 *   24–29 July   the owner says leads come in on four channels and nobody owns
 *                them; they agree a response rule.
 *   3 August     every enquiry gets a named agent and a call back within four
 *                working hours, tracked on one shared sheet. The QR card goes
 *                into the welcome folder the same week.
 *   Aug–Sept     site-visit complaints disappear. Follow-up complaints do not
 *                move, and "no support after payment" starts to appear.
 *   8 September  second check-in: follow-up steady, visits better, after-deal
 *                support worse.
 *   13 September Headway compares before and after: no clear change in how
 *                often follow-up comes up. The rule is not being kept.
 */

const r = (at: string, stars: number | null, text: string): PublicReview => ({ at, stars, text });

export const NESTORA_PROPERTIES: DemoStory = {
  businessName: 'Nestora Properties',
  vertical: 'real_estate',

  earlyReviews: [
    r('2026-06-09T12:10:00+05:30', 5, 'Honest advice from day one, and they never pushed us toward anything outside our budget.'),
    r('2026-06-12T18:30:00+05:30', 2, 'Enquired about a 2BHK rental and got no callback for four days.'),
    r('2026-06-18T17:20:00+05:30', 2, 'The site visit agent did not turn up and nobody informed us.'),
    r('2026-06-21T13:00:00+05:30', 5, 'Transparent about brokerage and very genuine people.'),
    r('2026-06-24T19:10:00+05:30', 2, 'Sent three messages and got no response. Had to go to the office myself.'),
    r('2026-06-27T16:40:00+05:30', 3, 'They showed us good options, but follow-up is very slow. Never called back after the second visit.'),
    r('2026-06-30T12:25:00+05:30', null, 'Agent ne 3 din tak jawab nahi diya, baaki kaam theek tha.'),
    r('2026-07-04T18:20:00+05:30', 2, 'Asked for two more options a week ago. Still no response.'),
    r('2026-07-05T11:30:00+05:30', 2, 'Keys were not with the agent at the site visit, so we saw nothing.'),
    r('2026-07-07T19:00:00+05:30', 2, 'Unresponsive once the first visit was done. We found a flat elsewhere.'),
  ],

  firstCheckin: {
    label: 'Check-in — July',
    capturedAt: '2026-07-09T11:00:00+05:30',
    rating: 4.1,
    reviewCount: 74,
    unansweredCount: 29,
    reviewsPerWeek: 1.2,
    daysSinceLastPost: 40,
    photoRecencyDays: 75,
    reviews: [
      r('', 5, 'Very honest and upfront about every charge.'),
      r('', 2, 'No response to my calls for two days.'),
      r('', 4, 'Expert advice, but we waited 40 minutes at the society gate for the agent.'),
      r('', 2, 'The owner did not show and the agent did not turn up either.'),
      r('', 4, 'Genuine people, no hidden costs.'),
      r('', 2, 'Never called back after I shared my requirements.'),
      r('', 3, 'Good knowledge of the market but the visit was a no show.'),
      r('', 3, 'No callback unless I chased them. Otherwise transparent.'),
    ],
  },

  midReviews: [
    r('2026-07-11T11:45:00+05:30', 4, 'Knows the area really well and suggested societies we had not considered.'),
    r('2026-07-14T12:40:00+05:30', 5, 'Trustworthy team, and they helped with the rental agreement paperwork.'),
    r('2026-07-17T17:55:00+05:30', 3, 'Nice flats shown but the agent ignored my follow-up messages.'),
    r('2026-07-20T11:10:00+05:30', 4, 'Good shortlist that matched our brief.'),
    r('2026-07-23T18:05:00+05:30', 4, 'Patient and not pushy at all. Took time to understand what we needed.'),
    r('2026-07-25T16:30:00+05:30', 3, 'They asked for extra brokerage at the end that was never mentioned.'),
  ],

  owner: {
    conversation: {
      at: '2026-07-24T15:00:00+05:30',
      title: 'Owner raised slow follow-up with clients',
      body: 'Owner says enquiries arrive by phone, WhatsApp, the listing sites and walk-ins, and nobody owns a lead once the first visit is done.',
    },
    context: [
      {
        at: '2026-07-24T15:05:00+05:30',
        kind: 'OPERATING',
        text: 'Most enquiries come in on weekends and are followed up during the week',
        themeKey: 'responsiveness',
      },
      {
        at: '2026-07-24T15:06:00+05:30',
        kind: 'FOCUS',
        text: 'Clients saying we never call back is my biggest worry',
        themeKey: 'responsiveness',
      },
      {
        at: '2026-07-24T15:08:00+05:30',
        kind: 'CONSTRAINT',
        text: 'We cannot hire another agent before Diwali',
        constraintKey: 'STAFF',
      },
    ],
    followUp: {
      at: '2026-07-31T15:00:00+05:30',
      title: 'Check the callback sheet after a month',
      body: 'Agreed to review the shared lead sheet with the owner at the next monthly call.',
    },
    afterNote: {
      at: '2026-09-13T18:00:00+05:30',
      title: 'Callback rule is not being kept',
      body: 'Owner found that weekend leads still wait until Tuesday. Will make one agent responsible for weekend callbacks.',
    },
  },

  action: {
    suggestedAt: '2026-07-27T11:00:00+05:30',
    decidedAt: '2026-07-29T11:00:00+05:30',
    description: 'Every enquiry now gets a named agent and a call back within four working hours, tracked on one shared sheet',
    doneAt: '2026-08-03T09:00:00+05:30',
    measuredAt: '2026-09-13T11:00:00+05:30',
    learning:
      'Follow-up complaints did not move after the callback rule. Weekend leads still wait until Tuesday, so the rule needs an owner on weekends.',
  },

  lateReviews: [
    r('2026-08-07T12:15:00+05:30', 4, 'Got a call back the same afternoon this time. Good market knowledge.'),
    r('2026-08-12T18:40:00+05:30', 2, 'No callback for three days after the visit, again.'),
    r('2026-08-19T11:30:00+05:30', 5, 'Honest, patient and never pushy.'),
    r('2026-08-25T17:10:00+05:30', 2, 'Once we paid the token they stopped responding. No support with the society forms.'),
    r('2026-08-31T19:20:00+05:30', 3, 'Agent is knowledgeable but messages still go unanswered for days. No response on weekends.'),
    r('2026-09-07T12:50:00+05:30', 2, 'After payment nobody helps with the move-in paperwork.'),
    r('2026-09-14T16:05:00+05:30', 4, 'Upfront about charges and they suggested a better building.'),
  ],

  secondCheckin: {
    label: 'Check-in — September',
    capturedAt: '2026-09-08T11:00:00+05:30',
    rating: 4.0,
    reviewCount: 88,
    unansweredCount: 26,
    reviewsPerWeek: 1.5,
    daysSinceLastPost: 22,
    photoRecencyDays: 45,
    reviews: [
      r('', 5, 'Transparent and genuine, would use them again.'),
      r('', 2, 'No response for a week after the site visit.'),
      r('', 4, 'Knows the area and gave honest advice.'),
      r('', 2, 'Stopped responding after the deal was signed.'),
      r('', 3, 'Good options but they never called back.'),
      r('', 2, 'Agent ignored my messages about the lease renewal.'),
      r('', 4, 'Expert guidance on the rental market, but no support after deal closed.'),
      r('', 2, 'No support after payment, had to sort out everything myself.'),
    ],
  },

  qr: [
    {
      at: '2026-08-06T18:10:00+05:30',
      stars: 5,
      dimensions: { communication: 5, visits: 5, options: 5 },
      signals: ['quick_replies', 'on_time_visits', 'matched_brief'],
      text: '',
    },
    {
      at: '2026-08-10T12:30:00+05:30',
      stars: 2,
      dimensions: { communication: 1, visits: 4 },
      signals: ['no_reply', 'chased', 'knowledgeable'],
      text: 'Messages went unanswered and there was no callback.',
    },
    {
      at: '2026-08-14T17:45:00+05:30',
      stars: 4,
      dimensions: { options: 5, transparency: 5 },
      signals: ['good_shortlist', 'upfront_costs'],
      text: 'Good shortlist and upfront about the brokerage.',
    },
    {
      at: '2026-08-18T11:20:00+05:30',
      stars: 3,
      dimensions: { communication: 2, paperwork: 3 },
      signals: ['slow', 'no_updates'],
      text: 'Slow to come back, no callback after the second visit.',
    },
    {
      at: '2026-08-22T19:05:00+05:30',
      stars: 5,
      dimensions: { transparency: 5, visits: 5 },
      signals: ['no_pressure', 'knowledgeable'],
      text: 'Honest advice and no pressure at all.',
    },
    {
      at: '2026-08-26T16:15:00+05:30',
      stars: 2,
      dimensions: { communication: 2, paperwork: 2 },
      signals: ['chased', 'after_deal', 'no_updates'],
      text: 'No response once the agreement was signed.',
    },
    {
      at: '2026-08-29T12:00:00+05:30',
      stars: 4,
      dimensions: {},
      signals: [],
      text: '',
    },
    {
      at: '2026-09-01T18:25:00+05:30',
      stars: 3,
      dimensions: { communication: 2, options: 4 },
      signals: ['slow'],
      text: 'Options were fine but follow-up is slow and I was ignored for a week.',
    },
    {
      at: '2026-09-05T11:40:00+05:30',
      stars: 5,
      dimensions: { communication: 4, transparency: 5, options: 5, visits: 5, paperwork: 4 },
      signals: ['upfront_costs', 'accurate_listings'],
      text: '',
    },
    {
      at: '2026-09-09T17:30:00+05:30',
      stars: 2,
      dimensions: { communication: 1 },
      signals: ['no_reply', 'changed_hands'],
      text: 'Passed between three agents and no callback from any of them.',
    },
    {
      at: '2026-09-12T13:10:00+05:30',
      stars: 4,
      dimensions: { transparency: 4, visits: 5 },
      signals: ['answered_everything'],
      text: 'Very genuine team, took time to answer everything.',
    },
    {
      at: '2026-09-15T18:50:00+05:30',
      stars: 3,
      dimensions: { paperwork: 2, communication: 3 },
      signals: ['after_deal', 'slow'],
      text: 'No support after payment for the society forms, and no response to calls.',
    },
    {
      at: '2026-09-17T11:55:00+05:30',
      stars: 2,
      dimensions: { transparency: 2 },
      signals: ['extra_charges'],
      text: 'Hidden charges for paperwork added at the end.',
    },
  ],
};
