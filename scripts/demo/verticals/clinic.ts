import type { DemoStory, PublicReview } from '../story';

/**
 * HARMONY CARE CLINIC — the clinic demo.
 *
 * Synthetic demo data for product evaluation. A fictional family clinic; no
 * real patient, doctor or business. Every piece of feedback is about the
 * visit — the wait, the booking, the desk, the room, how the doctor listened —
 * and never about a condition, a diagnosis or a treatment result.
 *
 *   June–July    patients love the doctor and the front desk. The evening
 *                wait keeps coming up: an hour past the slot, nobody saying
 *                how long.
 *   9 July       first check-in. Waiting time is the clearest complaint.
 *   24–29 July   the owner says one doctor covers every evening and another
 *                doctor is not possible this year; they agree to change the
 *                slot plan.
 *   3 August     15-minute slots with a buffer each hour, and reception tells
 *                each patient the expected wait at check-in. The QR card goes
 *                on the reception desk the same week.
 *   Aug–Sept     the waiting complaints fall away. What rises instead is the
 *                booking: moved slots, no confirmation, no slot for days.
 *   8 September  second check-in: waiting down, booking problems up.
 *   12 September Headway compares before and after: waiting mentioned far
 *                less often after the change. Next: confirm every booking.
 */

const r = (at: string, stars: number | null, text: string): PublicReview => ({ at, stars, text });

export const HARMONY_CARE_CLINIC: DemoStory = {
  businessName: 'Harmony Care Clinic',
  vertical: 'clinic',

  earlyReviews: [
    r('2026-06-11T10:40:00+05:30', 5, 'The doctor listened patiently and explained every step of the plan. Felt in safe hands.'),
    r('2026-06-13T19:20:00+05:30', 2, 'Booked the 6:30 slot and was called in at 7:45. The waiting room was packed.'),
    r('2026-06-16T09:55:00+05:30', 4, 'Reception staff were polite and helpful with the insurance forms.'),
    r('2026-06-18T20:10:00+05:30', 3, 'Good doctor, but the wait in the evening is too long.'),
    r('2026-06-21T11:30:00+05:30', 5, 'Very clean clinic and the doctor explained things in simple words.'),
    r('2026-06-24T18:45:00+05:30', 2, 'Waited over an hour past my appointment with two kids. Nobody told us how long it would be.'),
    r('2026-06-27T12:15:00+05:30', null, 'Doctor saab ne acha samjhaya, par intezaar bahut lamba tha.'),
    r('2026-06-30T19:30:00+05:30', 4, 'Caring doctor and friendly nurses. Only issue is the evening queue.'),
    r('2026-07-03T10:05:00+05:30', 5, 'Neat, well kept place and the front desk was very helpful.'),
    r('2026-07-06T20:20:00+05:30', 2, 'Evening OPD runs late every time I come. Came at 7 and left at 9.'),
  ],

  firstCheckin: {
    label: 'Check-in — July',
    capturedAt: '2026-07-09T11:00:00+05:30',
    rating: 4.3,
    reviewCount: 142,
    unansweredCount: 38,
    reviewsPerWeek: 2.2,
    daysSinceLastPost: 21,
    photoRecencyDays: 40,
    reviews: [
      r('', 5, 'Best doctor in Baner for the whole family.'),
      r('', 2, 'Long waiting time even with an appointment.'),
      r('', 4, 'Staff are friendly and the clinic is clean.'),
      r('', 2, 'Waited 50 minutes past my slot.'),
      r('', 5, 'The doctor was very good, explained all my questions.'),
      r('', 3, 'Nice doctor but the queue in the evening is too much.'),
      r('', 4, 'Kind and patient doctor, polite reception.'),
      r('', 2, 'Always a delay in the evenings.'),
    ],
  },

  midReviews: [
    r('2026-07-11T19:40:00+05:30', 2, 'Sat in the waiting area for 70 minutes. Please fix the evening timings.'),
    r('2026-07-14T10:30:00+05:30', 5, 'Very caring doctor who takes time with every patient.'),
    r('2026-07-17T18:50:00+05:30', 3, 'डॉक्टर छान आहेत पण संध्याकाळी खूप वेळ थांबावं लागतं.'),
    r('2026-07-20T20:35:00+05:30', 2, "An hour's wait again, and the receptionist could not say when I would be called."),
    r('2026-07-22T11:10:00+05:30', 4, 'Helpful staff and a spotless reception area.'),
    r('2026-07-25T19:15:00+05:30', 3, 'The bill was not explained until I asked at the counter.'),
  ],

  owner: {
    conversation: {
      at: '2026-07-24T12:00:00+05:30',
      title: 'Owner raised the evening waiting times',
      body: 'Owner says one doctor covers the whole evening OPD and that appointments are booked back to back from 5pm, so any long consultation pushes everyone after it.',
    },
    context: [
      {
        at: '2026-07-24T12:05:00+05:30',
        kind: 'OPERATING',
        text: 'Evenings from 5 to 9 are our busiest, and one doctor covers them',
        themeKey: 'wait_time',
      },
      {
        at: '2026-07-24T12:06:00+05:30',
        kind: 'FOCUS',
        text: 'Patients waiting past their slot is my biggest worry',
        themeKey: 'wait_time',
      },
      {
        at: '2026-07-24T12:08:00+05:30',
        kind: 'CONSTRAINT',
        text: 'We cannot add another doctor this year',
        constraintKey: 'STAFF',
      },
    ],
    answer: { at: '2026-07-30T10:00:00+05:30', themeKey: 'wait_time', answer: 'The doctor runs late' },
    followUp: {
      at: '2026-07-31T10:00:00+05:30',
      title: 'Check the new slot plan after two weeks',
      body: 'Agreed to look at how the evening runs once the new slots have been in place for a fortnight.',
    },
    afterNote: {
      at: '2026-09-12T18:00:00+05:30',
      title: 'Booking confirmations next',
      body: 'Owner will have reception confirm every booked or moved appointment by message the same day.',
    },
  },

  action: {
    suggestedAt: '2026-07-27T11:00:00+05:30',
    decidedAt: '2026-07-29T11:00:00+05:30',
    description: 'Moved to 15-minute slots with a buffer every hour, and reception now tells each patient the expected wait at check-in',
    doneAt: '2026-08-03T09:00:00+05:30',
    measuredAt: '2026-09-12T11:00:00+05:30',
    learning:
      'Waiting complaints fell away after the new slot plan. Booking problems rose in the same weeks, so every moved appointment now needs a confirmation.',
  },

  lateReviews: [
    r('2026-08-06T18:30:00+05:30', 5, 'Seen on time for my evening slot, and reception told me upfront how long it would be.'),
    r('2026-08-11T20:05:00+05:30', 2, 'My appointment was moved twice and there was no confirmation of the new time.'),
    r('2026-08-18T10:20:00+05:30', 5, 'The doctor explained the reports clearly and never rushed me.'),
    r('2026-08-24T19:40:00+05:30', 2, 'Came for my slot and found it had been given to someone else. They double book the evening slots.'),
    r('2026-08-30T11:25:00+05:30', 4, 'Quick check-in this time and the staff were very polite.'),
    r('2026-09-05T18:55:00+05:30', 3, 'Good doctor. Could not get an appointment for three days though, the phone line kept saying full.'),
    r('2026-09-15T20:30:00+05:30', 2, 'Got a message that my appointment was cancelled an hour before. No reason given.'),
  ],

  secondCheckin: {
    label: 'Check-in — September',
    capturedAt: '2026-09-08T11:00:00+05:30',
    rating: 4.4,
    reviewCount: 171,
    unansweredCount: 24,
    reviewsPerWeek: 2.9,
    daysSinceLastPost: 9,
    photoRecencyDays: 18,
    reviews: [
      r('', 5, 'Excellent doctor, explained everything patiently.'),
      r('', 2, 'Booking problem again, my slot was moved without asking.'),
      r('', 4, 'Seen on time and the reception was friendly.'),
      r('', 2, 'No slot for a week, had to go elsewhere.'),
      r('', 5, 'Caring doctor and a very clean clinic.'),
      r('', 3, 'Appointment cancelled by the clinic at the last minute.'),
      r('', 4, 'Polite and helpful staff at the desk.'),
      r('', 3, 'A bit of a wait at reception, otherwise fine.'),
    ],
  },

  qr: [
    {
      at: '2026-08-05T19:10:00+05:30',
      stars: 5,
      dimensions: { waiting: 5, staff: 5, consultation: 5, booking: 5, cleanliness: 5 },
      signals: ['on_time', 'explained_well'],
      text: '',
    },
    {
      at: '2026-08-08T18:40:00+05:30',
      stars: 4,
      dimensions: { waiting: 4, staff: 5, consultation: 5, booking: 4, cleanliness: 4 },
      signals: ['friendly'],
      text: 'The doctor listened properly. Reception said I would be seen in twenty minutes and I was.',
    },
    {
      at: '2026-08-12T20:15:00+05:30',
      stars: 2,
      dimensions: { waiting: 3, staff: 3, consultation: 4, booking: 1, cleanliness: 4 },
      signals: ['moved', 'time_confusion', 'no_update', 'unclear_answers'],
      text: 'The clinic moved my appointment and I only found out at the desk. There was no confirmation of the change.',
    },
    {
      at: '2026-08-15T11:00:00+05:30',
      stars: 5,
      dimensions: { waiting: 5, staff: 5, consultation: 5, booking: 5, cleanliness: 5 },
      signals: ['felt_heard', 'consult_room_clean'],
      text: 'Very clean, and the doctor explained my prescription in detail.',
    },
    {
      at: '2026-08-19T19:50:00+05:30',
      stars: 3,
      dimensions: { waiting: 3, staff: 4, consultation: 4, booking: 2, cleanliness: 4 },
      signals: ['no_answer', 'no_slot'],
      text: 'Could not get through to book, and then no slot until Friday.',
    },
    {
      at: '2026-08-22T10:35:00+05:30',
      stars: 4,
      dimensions: {},
      signals: [],
      text: '',
    },
    {
      at: '2026-08-26T18:20:00+05:30',
      stars: 5,
      dimensions: { waiting: 5, staff: 5, consultation: 5, booking: 4, cleanliness: 5 },
      signals: ['on_time', 'helpful'],
      text: '',
    },
    {
      at: '2026-08-29T20:40:00+05:30',
      stars: 2,
      dimensions: { waiting: 4, staff: 3, consultation: 4, booking: 1, cleanliness: 4 },
      signals: ['moved', 'unclear_answers'],
      text: 'My appointment was cancelled and moved twice in one week. The desk could not say why.',
    },
    {
      at: '2026-09-02T11:45:00+05:30',
      stars: 4,
      dimensions: { waiting: 4, staff: 4, consultation: 5, booking: 4, cleanliness: 4 },
      signals: ['unhurried', 'short_wait'],
      text: 'Unhurried consultation and a clear plan. Seen almost on time, which is new.',
    },
    {
      at: '2026-09-06T19:05:00+05:30',
      stars: 3,
      dimensions: { waiting: 4, staff: 4, consultation: 4, booking: 2, cleanliness: 4 },
      signals: ['time_confusion', 'helpful'],
      text: 'Booking problem: two different times in the message and on the call.',
    },
    {
      at: '2026-09-10T12:30:00+05:30',
      stars: 5,
      dimensions: { waiting: 5, staff: 5, consultation: 5, booking: 5, cleanliness: 5 },
      signals: ['friendly', 'waiting_area_clean'],
      text: 'Lovely helpful staff.',
    },
    {
      at: '2026-09-13T18:10:00+05:30',
      stars: 2,
      dimensions: { waiting: 2, staff: 4, consultation: 4, booking: 2, cleanliness: 4 },
      signals: ['no_slot', 'long_past_slot'],
      text: 'No appointment available all week, and when I finally came in, a long time in reception.',
    },
    {
      at: '2026-09-17T10:15:00+05:30',
      stars: 4,
      dimensions: { waiting: 4, staff: 3, consultation: 4, booking: 4, cleanliness: 4 },
      signals: ['explained_well', 'billing'],
      text: 'Good consultation, but the final bill was not explained.',
    },
  ],
};
