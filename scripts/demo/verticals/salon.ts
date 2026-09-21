import type { DemoStory, PublicReview } from '../story';

/**
 * AURA STUDIO & SPA — the salon demo.
 *
 * Synthetic demo data for product evaluation. A fictional salon and day spa;
 * no real client, stylist or business.
 *
 *   June–early Aug  clients love the stylists and the calm of the place. The
 *                   appointment keeps slipping: seen 30, 40, 60 minutes past
 *                   the booked time, no confirmation, slots given away.
 *   8 July          first check-in. Appointment problems are the clearest complaint.
 *   5–9 August      the owner says senior stylists are double-booked on
 *                   weekends; they agree to stop it and pad colour services.
 *   12 August       no double-booking of senior stylists, and a 15-minute
 *                   buffer after every colour service. The QR card goes on the
 *                   mirror stations the same week.
 *   Aug–Sept        appointment complaints ease — fewer, not gone. A new one
 *                   appears: therapists pushing packages and add-ons.
 *   9 September     second check-in: appointments better, upselling up.
 *   14 September    Headway compares before and after: appointment problems came
 *                   up less often after the change. Still the top complaint, so
 *                   it stays on Home until it settles.
 */

const r = (at: string, stars: number | null, text: string): PublicReview => ({ at, stars, text });

export const AURA_STUDIO_SPA: DemoStory = {
  businessName: 'Aura Studio & Spa',
  vertical: 'salon',

  earlyReviews: [
    r('2026-06-08T13:20:00+05:30', 5, 'Loved my haircut. The stylist listened to exactly what I wanted.'),
    r('2026-06-11T18:40:00+05:30', 3, 'Great cut, but I was seen 35 minutes past my appointment time.'),
    r('2026-06-17T17:30:00+05:30', 4, 'Friendly staff and a skilled colourist. Worth the price.'),
    r('2026-06-20T19:10:00+05:30', 2, 'Booked for 6 and the chair was free at 6:50. Past my appointment by almost an hour with no explanation.'),
    r('2026-06-26T16:20:00+05:30', null, 'Stylist bahut acchi hai par appointment ka koi bharosa nahi, booking problem har baar.'),
    r('2026-06-29T18:55:00+05:30', 4, 'Polite team and tools sanitised in front of me.'),
    r('2026-06-30T18:30:00+05:30', 2, 'Seen almost an hour past my appointment time on a Saturday.'),
    r('2026-07-02T14:10:00+05:30', 2, 'No confirmation call and they had given my slot away when I arrived.'),
    r('2026-07-04T17:15:00+05:30', 3, 'Great haircut as always, but I was taken 30 minutes past my appointment.'),
    r('2026-07-05T17:40:00+05:30', 5, 'Expert advice on colour, and the result was exactly what I asked for.'),
  ],

  firstCheckin: {
    label: 'Check-in — July',
    capturedAt: '2026-07-08T11:00:00+05:30',
    rating: 4.4,
    reviewCount: 236,
    unansweredCount: 64,
    reviewsPerWeek: 3.6,
    daysSinceLastPost: 10,
    photoRecencyDays: 12,
    reviews: [
      r('', 5, 'Stylist was great, loved my hair.'),
      r('', 2, 'Started 40 minutes past my appointment.'),
      r('', 4, 'Friendly and welcoming, very clean salon.'),
      r('', 3, 'Good haircut but no confirmation of the booking until I called.'),
      r('', 5, 'Relaxing pedicure and patient staff.'),
      r('', 2, 'Booking problem again, they double booked my stylist.'),
      r('', 4, 'Skilled stylist, reasonable prices.'),
      r('', 3, 'Could not get an appointment on the weekend for three weeks.'),
    ],
  },

  midReviews: [
    r('2026-07-13T11:15:00+05:30', 5, 'So relaxing, the head massage was the best part. Very clean place.'),
    r('2026-07-16T13:00:00+05:30', 5, 'The staff were lovely and my colour turned out beautifully.'),
    r('2026-07-21T12:45:00+05:30', 5, 'Hair looks great and the spa room is so calm.'),
    r('2026-07-24T12:20:00+05:30', 4, 'Calm, hygienic and a skilled, patient therapist.'),
    r('2026-07-28T19:40:00+05:30', 2, 'Appointment was cancelled by text an hour before. Second time this month.'),
    r('2026-08-01T16:05:00+05:30', 5, 'Loved the haircut and the stylist suggested a style that suits me.'),
    r('2026-08-06T18:45:00+05:30', 2, 'No confirmation, and then 45 minutes past my appointment.'),
  ],

  owner: {
    conversation: {
      at: '2026-08-05T12:00:00+05:30',
      title: 'Owner raised appointments running over',
      body: 'Owner says the two senior stylists are booked back to back on weekends, and a colour service that runs long pushes every client after it.',
    },
    context: [
      {
        at: '2026-08-05T12:05:00+05:30',
        kind: 'OPERATING',
        text: 'Saturdays and Sundays are fully booked, and colour services often run long',
        themeKey: 'appointment_scheduling',
      },
      {
        at: '2026-08-05T12:06:00+05:30',
        kind: 'FOCUS',
        text: 'Clients kept waiting past their booked time is my biggest worry',
        themeKey: 'appointment_scheduling',
      },
      {
        at: '2026-08-05T12:08:00+05:30',
        kind: 'CONSTRAINT',
        text: 'We cannot add another senior stylist right now',
        constraintKey: 'STAFF',
      },
    ],
    answer: {
      at: '2026-08-10T10:00:00+05:30',
      themeKey: 'appointment_scheduling',
      answer: 'The same stylist is double-booked',
    },
    followUp: {
      at: '2026-08-11T10:00:00+05:30',
      title: 'Check weekend bookings after a month',
      body: 'Agreed to look at the weekend appointment book again at the next monthly call.',
    },
    afterNote: {
      at: '2026-09-14T18:00:00+05:30',
      title: 'Keep the buffer, brief the spa team',
      body: 'Owner will keep the colour buffer and tell the spa team to offer add-ons once, not push them.',
    },
  },

  action: {
    suggestedAt: '2026-08-08T11:00:00+05:30',
    decidedAt: '2026-08-09T11:00:00+05:30',
    description: 'Stopped double-booking the senior stylists and added a 15-minute buffer after every colour service',
    doneAt: '2026-08-12T09:00:00+05:30',
    measuredAt: '2026-09-14T11:00:00+05:30',
    learning:
      'Appointment complaints came up less often after the buffer. Still the most common complaint, so the buffer stays and weekends get watched.',
  },

  lateReviews: [
    r('2026-08-16T12:30:00+05:30', 5, 'Chair was ready on time for once, and the stylist was excellent.'),
    r('2026-08-21T18:10:00+05:30', 4, 'Nice facial, though the room was a little cold.'),
    r('2026-08-27T13:45:00+05:30', 4, 'Friendly team, great cut, started only a little past my appointment.'),
    r('2026-09-02T17:55:00+05:30', 5, 'The manicure was quick and neat. A skilled team.'),
    r('2026-09-06T11:20:00+05:30', 5, 'Relaxing and spotless. The staff are lovely.'),
    r('2026-09-10T19:30:00+05:30', 3, 'Charged more than the price quoted for the colour, though the result was worth it.'),
    r('2026-09-15T16:40:00+05:30', 4, 'Skilled stylist, and I was seen on time.'),
  ],

  secondCheckin: {
    label: 'Check-in — September',
    capturedAt: '2026-09-09T11:00:00+05:30',
    rating: 4.5,
    reviewCount: 262,
    unansweredCount: 41,
    reviewsPerWeek: 3.9,
    daysSinceLastPost: 6,
    photoRecencyDays: 9,
    reviews: [
      r('', 5, 'Loved my haircut, very skilled team.'),
      r('', 3, 'Good haircut but they pushed a membership at billing.'),
      r('', 4, 'Friendly staff, on time, though they tried to sell me a hair spa.'),
      r('', 2, 'Still 30 minutes past my appointment on Sunday.'),
      r('', 5, 'Calm and relaxing, and very clean.'),
      r('', 2, 'Kept insisting on a package after my haircut.'),
      r('', 4, 'Patient stylist who listened well.'),
      r('', 3, 'Nice colour but no confirmation message again.'),
    ],
  },

  qr: [
    {
      at: '2026-08-14T13:10:00+05:30',
      stars: 5,
      dimensions: { result: 5, stylist: 5, waiting: 5, cleanliness: 5, value: 5 },
      signals: ['loved_result', 'listened_well', 'seen_on_time'],
      text: '',
    },
    {
      at: '2026-08-18T17:40:00+05:30',
      stars: 4,
      dimensions: { result: 5, stylist: 4, waiting: 4, cleanliness: 4, value: 4 },
      signals: ['exactly_what_asked', 'friendly'],
      text: 'Great cut and a friendly stylist.',
    },
    {
      at: '2026-08-22T12:05:00+05:30',
      stars: 3,
      dimensions: { result: 4, stylist: 3, waiting: 4, cleanliness: 4, value: 3 },
      signals: ['rushed', 'extras_added'],
      text: 'Blow dry was fine, nothing special.',
    },
    {
      at: '2026-08-25T18:20:00+05:30',
      stars: 5,
      dimensions: { result: 5, stylist: 5, waiting: 5, cleanliness: 5, value: 5 },
      signals: ['fresh_towels', 'skilled'],
      text: '',
    },
    {
      at: '2026-08-29T11:30:00+05:30',
      stars: 4,
      dimensions: {},
      signals: [],
      text: '',
    },
    {
      at: '2026-09-01T16:50:00+05:30',
      stars: 2,
      dimensions: { result: 4, stylist: 4, waiting: 2, cleanliness: 4, value: 4 },
      signals: ['past_appointment'],
      text: 'Half an hour past my appointment again.',
    },
    {
      at: '2026-09-04T19:15:00+05:30',
      stars: 5,
      dimensions: { result: 5, stylist: 5, waiting: 5, cleanliness: 5, value: 5 },
      signals: ['lasted_well', 'worth_it'],
      text: 'Colour lasted really well, worth every rupee.',
    },
    {
      at: '2026-09-08T13:35:00+05:30',
      stars: 4,
      dimensions: { result: 4, stylist: 4, waiting: 4, cleanliness: 5, value: 4 },
      signals: ['friendly', 'salon_clean'],
      text: 'The staff were polite and the place was spotless. Great cut too.',
    },
    {
      at: '2026-09-11T17:05:00+05:30',
      stars: 5,
      dimensions: { result: 5, stylist: 5, waiting: 5, cleanliness: 5, value: 4 },
      signals: ['loved_result', 'seen_on_time', 'salon_clean'],
      text: '',
    },
    {
      at: '2026-09-13T12:40:00+05:30',
      stars: 4,
      dimensions: { result: 5, stylist: 4, waiting: 4, cleanliness: 4, value: 4 },
      signals: ['no_wait'],
      text: 'Seen on time and the stylist was great.',
    },
    {
      at: '2026-09-15T18:30:00+05:30',
      stars: 3,
      dimensions: { result: 4, stylist: 4, waiting: 4, cleanliness: 4, value: 2 },
      signals: ['more_than_quoted'],
      text: 'Charged more than quoted for the hair spa.',
    },
    {
      at: '2026-09-17T14:15:00+05:30',
      stars: 5,
      dimensions: { result: 5, stylist: 5, waiting: 5, cleanliness: 5, value: 5 },
      signals: ['listened_well'],
      text: 'Patient and friendly, loved my hair.',
    },
    {
      at: '2026-09-18T19:00:00+05:30',
      stars: 2,
      dimensions: { result: 4, stylist: 4, waiting: 2, cleanliness: 4, value: 4 },
      signals: ['past_appointment'],
      text: 'Taken 25 minutes past my appointment time.',
    },
  ],
};
