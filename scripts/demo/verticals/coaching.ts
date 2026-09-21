import type { DemoStory, PublicReview } from '../story';

/**
 * BRIGHTPATH ACADEMY — the coaching / tuition demo.
 *
 * Synthetic demo data for product evaluation. A fictional tuition centre for
 * classes 8 to 12; the voices are students and parents, and no real student,
 * teacher or business is described.
 *
 *   June–July    teaching is the reason families come: clear explanations,
 *                patient teachers, doubt sessions. What keeps coming up is the
 *                timetable — classes cancelled, timings changed, parents not told.
 *   9 July       first check-in. Timetable changes are the clearest complaint.
 *   24–29 July   the owner explains that faculty juggle school-exam duty, rules
 *                out any fee change, and agrees a fixed weekly timetable.
 *   3 August     the timetable goes out every Sunday evening, and any change
 *                reaches the parents' group at least 48 hours ahead. The QR
 *                card goes up at the front desk the same week.
 *   Aug–Sept     timetable complaints fall away. New admissions for the term
 *                fill the evening batch, and "too many students" starts to rise.
 *   8 September  second check-in: timetable complaints down, batch size up.
 *   12 September Headway compares before and after: the timetable came up far
 *                less often after the change. Next: split the evening batch.
 */

const r = (at: string, stars: number | null, text: string): PublicReview => ({ at, stars, text });

export const BRIGHTPATH_ACADEMY: DemoStory = {
  businessName: 'BrightPath Academy',
  vertical: 'coaching',

  earlyReviews: [
    r('2026-06-10T17:30:00+05:30', 5, 'Physics sir explains well and never makes you feel silly for asking.'),
    r('2026-06-13T20:10:00+05:30', 3, 'Good teaching but the Saturday class timing changed twice this month.'),
    r('2026-06-16T18:45:00+05:30', 5, "My daughter's maths marks improved from 62 to 81 in one term."),
    r('2026-06-19T19:00:00+05:30', 2, 'Class cancelled at the last minute and we were not informed. Wasted a trip across town.'),
    r('2026-06-22T16:20:00+05:30', 4, 'Supportive teachers and the doubt sessions on Sunday really help.'),
    r('2026-06-25T21:00:00+05:30', 5, 'Best teacher for chemistry in the area. Concepts are crystal clear.'),
    r('2026-06-28T19:35:00+05:30', 3, 'Batch timing changed again without much notice. Hard to plan tuition around school.'),
    r('2026-07-01T18:05:00+05:30', 4, 'Test series is well prepared and the teachers are approachable.'),
    r('2026-07-03T20:40:00+05:30', null, 'Sir padhate bahut accha hain, lekin class baar baar postponed hoti hai.'),
    r('2026-07-06T17:50:00+05:30', 2, 'Two classes postponed in one week and no update on when they would be taken.'),
  ],

  firstCheckin: {
    label: 'Check-in — July',
    capturedAt: '2026-07-09T11:00:00+05:30',
    rating: 4.4,
    reviewCount: 96,
    unansweredCount: 31,
    reviewsPerWeek: 1.6,
    daysSinceLastPost: 34,
    photoRecencyDays: 60,
    reviews: [
      r('', 5, 'Excellent faculty and a very disciplined environment.'),
      r('', 2, 'Classes cancelled twice this month.'),
      r('', 4, 'Good teacher, patient with every question.'),
      r('', 3, 'Timing changed with one day notice.'),
      r('', 5, 'Teachers are good and they give personal attention.'),
      r('', 2, 'Irregular schedule, we never know when the next class is.'),
      r('', 4, 'Small batch and every doubt gets answered.'),
      r('', 3, 'Fees are worth it but the class was cancelled last Sunday.'),
    ],
  },

  midReviews: [
    r('2026-07-11T19:15:00+05:30', 2, 'Parents were not informed that the unit test was postponed.'),
    r('2026-07-14T17:40:00+05:30', 5, 'Chemistry teaching was excellent this term and the practice papers are spot on.'),
    r('2026-07-17T20:20:00+05:30', 3, 'Good teachers but too many students in the new evening batch.'),
    r('2026-07-20T18:50:00+05:30', 2, 'Class off on Monday and nobody messaged us. Poor communication from the office.'),
    r('2026-07-23T16:30:00+05:30', 4, 'Approachable teachers and regular weekly tests.'),
    r('2026-07-25T21:10:00+05:30', 2, 'Timing changed again for the Sunday batch. Very hard for working parents.'),
  ],

  owner: {
    conversation: {
      at: '2026-07-24T17:00:00+05:30',
      title: 'Owner raised timetable complaints from parents',
      body: 'Owner says two teachers are pulled into school exam duty at short notice, so classes get moved late and the office tells parents one by one.',
    },
    context: [
      {
        at: '2026-07-24T17:05:00+05:30',
        kind: 'OPERATING',
        text: 'Most students are in classes 9 to 12, and evening batches run from 5 to 9',
        themeKey: 'schedule_reliability',
      },
      {
        at: '2026-07-24T17:06:00+05:30',
        kind: 'FOCUS',
        text: 'Parents unhappy about timetable changes is my biggest worry',
        themeKey: 'schedule_reliability',
      },
      {
        at: '2026-07-24T17:08:00+05:30',
        kind: 'CONSTRAINT',
        text: 'Fees are fixed for this academic year',
        constraintKey: 'PRICE',
      },
    ],
    followUp: {
      at: '2026-07-31T17:00:00+05:30',
      title: 'Review the Sunday timetable after a month',
      body: 'Agreed to check at the next monthly call whether parents are hearing about changes in time.',
    },
    afterNote: {
      at: '2026-09-12T18:30:00+05:30',
      title: 'Splitting the evening batch',
      body: 'Owner is planning to split the largest evening batch into two sections from October.',
    },
  },

  action: {
    suggestedAt: '2026-07-27T11:00:00+05:30',
    decidedAt: '2026-07-29T11:00:00+05:30',
    description: 'The timetable now goes out every Sunday evening, and any class change reaches the parents group at least 48 hours ahead',
    doneAt: '2026-08-03T09:00:00+05:30',
    measuredAt: '2026-09-12T11:00:00+05:30',
    learning:
      'Timetable complaints dropped away after the Sunday schedule. The new admissions made the evening batch too big, which is the next thing to fix.',
  },

  lateReviews: [
    r('2026-08-06T18:00:00+05:30', 5, 'The weekly timetable on Sunday evening makes planning so much easier. Great teacher for maths too.'),
    r('2026-08-12T20:30:00+05:30', 2, 'The new batch has too many students. My son says he cannot ask anything in class.'),
    r('2026-08-19T19:10:00+05:30', 4, 'Supportive faculty and the test series is well organised.'),
    r('2026-08-26T17:20:00+05:30', 2, 'Over 55 students in one room now, far too crowded, and no individual attention anymore.'),
    r('2026-09-02T18:45:00+05:30', 5, 'Explains well, and we got a message two days before the only class change.'),
    r('2026-09-09T20:05:00+05:30', 3, 'Good teaching, but the batch size has doubled since August.'),
    r('2026-09-16T17:55:00+05:30', 2, 'A material charge was added to the fees that nobody mentioned at admission.'),
  ],

  secondCheckin: {
    label: 'Check-in — September',
    capturedAt: '2026-09-08T11:00:00+05:30',
    rating: 4.3,
    reviewCount: 118,
    unansweredCount: 19,
    reviewsPerWeek: 2.4,
    daysSinceLastPost: 8,
    photoRecencyDays: 21,
    reviews: [
      r('', 5, 'Best teacher for physics, concepts made simple.'),
      r('', 2, 'Too many students in each batch now.'),
      r('', 4, 'Patient teachers, though the batch has become too crowded.'),
      r('', 2, 'Batch size is too big, no personal attention.'),
      r('', 5, 'Teaching was good and my marks improved.'),
      r('', 3, 'Good classes but crowded, hard to see the board.'),
      r('', 4, 'Supportive faculty, good teacher overall.'),
      r('', 3, 'One class was postponed but we were told in advance.'),
    ],
  },

  qr: [
    {
      at: '2026-08-05T19:00:00+05:30',
      stars: 5,
      dimensions: { teaching: 5, faculty: 5, communication: 5, facilities: 5, value: 5 },
      signals: ['clear_explanations', 'kept_informed'],
      text: '',
    },
    {
      at: '2026-08-09T20:15:00+05:30',
      stars: 4,
      dimensions: { teaching: 5, faculty: 4, communication: 4, facilities: 4, value: 4 },
      signals: ['clear_updates'],
      text: 'The Sunday timetable message is really useful for us parents. Teachers are good too.',
    },
    {
      at: '2026-08-13T18:30:00+05:30',
      stars: 2,
      dimensions: { teaching: 4, faculty: 3, communication: 4, facilities: 2, value: 4 },
      signals: ['batch_size', 'too_hot', 'absent'],
      text: 'Too many students in the evening batch and the room gets too hot.',
    },
    {
      at: '2026-08-16T11:20:00+05:30',
      stars: 5,
      dimensions: { teaching: 5, faculty: 5, communication: 5, facilities: 5, value: 5 },
      signals: ['doubts_cleared', 'worth_it'],
      text: 'Every doubt gets cleared in the Saturday session. Worth the fees.',
    },
    {
      at: '2026-08-20T19:40:00+05:30',
      stars: 3,
      dimensions: { teaching: 4, faculty: 4, communication: 4, facilities: 2, value: 4 },
      signals: ['batch_size', 'seating'],
      text: '',
    },
    {
      at: '2026-08-23T17:05:00+05:30',
      stars: 4,
      dimensions: {},
      signals: [],
      text: '',
    },
    {
      at: '2026-08-27T20:50:00+05:30',
      stars: 2,
      dimensions: { teaching: 3, faculty: 3, communication: 4, facilities: 1, value: 4 },
      signals: ['batch_size', 'pace'],
      text: "60 students in one batch, the teacher cannot possibly check everyone's work.",
    },
    {
      at: '2026-08-31T18:15:00+05:30',
      stars: 5,
      dimensions: { teaching: 5, faculty: 5, communication: 5, facilities: 4, value: 5 },
      signals: ['clear_explanations', 'supportive', 'kept_informed'],
      text: 'Very supportive teachers and we always know the schedule now.',
    },
    {
      at: '2026-09-04T19:25:00+05:30',
      stars: 3,
      dimensions: { teaching: 4, faculty: 4, communication: 4, facilities: 2, value: 4 },
      signals: ['batch_size'],
      text: 'Batch size has become too big after the new admissions.',
    },
    {
      at: '2026-09-07T16:40:00+05:30',
      stars: 5,
      dimensions: { teaching: 5, faculty: 5, communication: 5, facilities: 5, value: 5 },
      signals: ['good_pace'],
      text: 'Explains well and at the right pace.',
    },
    {
      at: '2026-09-11T20:00:00+05:30',
      stars: 2,
      dimensions: { teaching: 4, faculty: 4, communication: 4, facilities: 3, value: 2 },
      signals: ['extra_charges', 'batch_size'],
      text: 'Extra charge for notes that nobody told us about, and the class is crowded.',
    },
    {
      at: '2026-09-14T18:35:00+05:30',
      stars: 4,
      dimensions: { teaching: 5, faculty: 4, communication: 4, facilities: 3, value: 4 },
      signals: ['clear_explanations', 'batch_size'],
      text: 'Great teacher, but too many students in the room now.',
    },
    {
      at: '2026-09-17T19:50:00+05:30',
      stars: 3,
      dimensions: { teaching: 4, faculty: 4, communication: 4, facilities: 2, value: 4 },
      signals: ['batch_size', 'washroom'],
      text: 'Please split the evening batch into two.',
    },
  ],
};
