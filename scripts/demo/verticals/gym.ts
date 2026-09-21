import type { DemoStory, PublicReview } from '../story';

/**
 * FORGE FITNESS STUDIO — the gym demo.
 *
 * Synthetic demo data for product evaluation. A fictional neighbourhood
 * strength-and-conditioning studio; no real member, trainer or business.
 *
 *   June–July    members rave about the trainers. The evening floor is the
 *                problem: too many people, waiting for machines, no space.
 *   9 July       first check-in. Evening crowding is the clearest complaint.
 *   24–29 July   the owner says the 7pm HIIT class takes half the floor, rules
 *                out cutting prices, and agrees to rework the evening.
 *   3 August     the 7pm class moves to 6:15am and 8:45pm, a second squat rack
 *                goes in, and evening floor time is booked in slots. The QR
 *                card goes up at the front desk the same week.
 *   Aug–Sept     crowding complaints fall away. Broken and worn equipment —
 *                treadmills, cables, the leg press — starts to rise.
 *   8 September  second check-in: crowding down, equipment complaints up.
 *   12 September Headway compares before and after: crowding came up far less
 *                often after the change. Next: a weekly maintenance round.
 */

const r = (at: string, stars: number | null, text: string): PublicReview => ({ at, stars, text });

export const FORGE_FITNESS_STUDIO: DemoStory = {
  businessName: 'Forge Fitness Studio',
  vertical: 'gym',

  earlyReviews: [
    r('2026-06-10T07:15:00+05:30', 5, 'Trainers are great here, proper form correction on every set.'),
    r('2026-06-13T19:40:00+05:30', 2, 'Way too crowded after 7pm. Spent half my workout waiting for machine time.'),
    r('2026-06-16T06:50:00+05:30', 5, 'Great energy in the morning batch and a really friendly crowd.'),
    r('2026-06-19T20:30:00+05:30', 3, 'Good trainer, but the evening rush at peak is too much.'),
    r('2026-06-22T08:10:00+05:30', 4, 'Clean floor and hygienic changing rooms. Fair monthly fee.'),
    r('2026-06-25T21:05:00+05:30', 2, 'Too many people in the weights area every evening. No space to even stretch.'),
    r('2026-06-28T18:20:00+05:30', null, 'Shaam ko bahut bheed hoti hai, trainer accha hai par machine milti nahi.'),
    r('2026-07-01T07:30:00+05:30', 5, "Lost weight steadily over three months with the trainer's guidance."),
    r('2026-07-03T19:55:00+05:30', 2, 'Crowded at peak hours, and the squat rack queue is endless.'),
    r('2026-07-06T09:15:00+05:30', 4, 'Knowledgeable trainers and the membership is worth the money.'),
  ],

  firstCheckin: {
    label: 'Check-in — July',
    capturedAt: '2026-07-09T11:00:00+05:30',
    rating: 4.2,
    reviewCount: 188,
    unansweredCount: 57,
    reviewsPerWeek: 3.1,
    daysSinceLastPost: 12,
    photoRecencyDays: 30,
    reviews: [
      r('', 5, 'Best trainer I have worked with, very motivating.'),
      r('', 2, 'Too crowded in the evening.'),
      r('', 4, 'Good vibe and clean equipment.'),
      r('', 2, 'Waited 15 minutes for a bench. Crowded every evening.'),
      r('', 5, 'Supportive trainers who actually watch your form.'),
      r('', 3, 'Great gym but too many people after work.'),
      r('', 4, 'Trainers are good and the timings are flexible.'),
      r('', 3, 'Cable machine not working, and the floor is crowded at 8pm.'),
    ],
  },

  midReviews: [
    r('2026-07-11T20:10:00+05:30', 2, 'No space on the floor between 7 and 9. Seriously considering switching to mornings.'),
    r('2026-07-14T06:40:00+05:30', 5, 'Great trainer, fixed my deadlift form in one session.'),
    r('2026-07-17T19:25:00+05:30', 3, 'Stuffy upstairs in the evening.'),
    r('2026-07-20T20:45:00+05:30', 2, 'Rush at peak time is unreal, I left without finishing.'),
    r('2026-07-23T08:00:00+05:30', 4, 'Hygienic and well kept, and the community here is lovely.'),
    r('2026-07-25T19:50:00+05:30', 2, 'Too many people and not enough benches.'),
  ],

  owner: {
    conversation: {
      at: '2026-07-24T13:00:00+05:30',
      title: 'Owner raised the evening crowding',
      body: 'Owner says the 7pm HIIT class takes half the floor at the busiest hour, and members who come to lift find nowhere to train.',
    },
    context: [
      {
        at: '2026-07-24T13:05:00+05:30',
        kind: 'OPERATING',
        text: 'Weekday evenings from 6 to 9 are our busiest time; mornings are quieter',
        themeKey: 'crowding',
      },
      {
        at: '2026-07-24T13:06:00+05:30',
        kind: 'FOCUS',
        text: 'Members leaving because the evening floor is packed is my biggest worry',
        themeKey: 'crowding',
      },
      {
        at: '2026-07-24T13:08:00+05:30',
        kind: 'CONSTRAINT',
        text: 'Do not suggest cutting membership prices',
        constraintKey: 'DISCOUNT',
      },
    ],
    answer: { at: '2026-07-30T10:00:00+05:30', themeKey: 'crowding', answer: 'Weekday evenings' },
    followUp: {
      at: '2026-07-31T10:00:00+05:30',
      title: 'Check the new evening plan after a month',
      body: 'Agreed to look at the evening feedback again once slot booking has run for a few weeks.',
    },
    afterNote: {
      at: '2026-09-12T18:00:00+05:30',
      title: 'Weekly maintenance round agreed',
      body: 'Owner will walk the floor every Monday with the maintenance contractor and tag any machine that is down.',
    },
  },

  action: {
    suggestedAt: '2026-07-27T11:00:00+05:30',
    decidedAt: '2026-07-29T11:00:00+05:30',
    description: 'Moved the 7pm HIIT class to 6:15am and 8:45pm, added a second squat rack, and started slot booking for the evening floor',
    doneAt: '2026-08-03T09:00:00+05:30',
    measuredAt: '2026-09-12T11:00:00+05:30',
    learning:
      'Crowding complaints fell after the evening rework. The machines are now taking the strain, so maintenance is the next thing to fix.',
  },

  lateReviews: [
    r('2026-08-06T19:30:00+05:30', 5, 'Slot booking for evenings works. Got the squat rack straight away. Trainers are great as always.'),
    r('2026-08-13T20:00:00+05:30', 2, 'Treadmill not working for over a week and nobody has fixed it.'),
    r('2026-08-20T07:10:00+05:30', 5, 'Motivating trainers and a great early morning crowd.'),
    r('2026-08-27T19:45:00+05:30', 2, 'Half the cardio machines are out of order. Paying full fee for this?'),
    r('2026-09-03T18:30:00+05:30', 4, 'Evenings feel calmer since the class moved. Knowledgeable coaches.'),
    r('2026-09-09T20:20:00+05:30', 2, 'The leg press is broken again and the cable pulley needs maintenance.'),
    r('2026-09-15T07:40:00+05:30', 3, 'Good trainer, but the rowing machine is still not repaired.'),
  ],

  secondCheckin: {
    label: 'Check-in — September',
    capturedAt: '2026-09-08T11:00:00+05:30',
    rating: 4.3,
    reviewCount: 214,
    unansweredCount: 33,
    reviewsPerWeek: 3.4,
    daysSinceLastPost: 5,
    photoRecencyDays: 14,
    reviews: [
      r('', 5, 'Great trainer, very knowledgeable.'),
      r('', 2, 'Treadmills broken for two weeks.'),
      r('', 4, 'Much easier to get a bench in the evening now. Friendly crowd too.'),
      r('', 2, 'Equipment not working and no one seems to care.'),
      r('', 5, 'Supportive trainers and good energy.'),
      r('', 3, 'Nice place but the bike is out of order again.'),
      r('', 4, 'Trainers are good, bit crowded at 7 on Mondays.'),
      r('', 2, 'Dumbbells missing from the rack and the treadmill was broken.'),
    ],
  },

  qr: [
    {
      at: '2026-08-05T19:20:00+05:30',
      stars: 5,
      dimensions: { equipment: 5, cleanliness: 5, trainers: 5, crowding: 5, facilities: 5 },
      signals: ['machines_available', 'good_guidance'],
      text: '',
    },
    {
      at: '2026-08-09T07:05:00+05:30',
      stars: 5,
      dimensions: { equipment: 5, cleanliness: 5, trainers: 5, crowding: 5, facilities: 5 },
      signals: ['motivating', 'changing_room_clean'],
      text: 'Best trainer in Viman Nagar.',
    },
    {
      at: '2026-08-12T20:25:00+05:30',
      stars: 3,
      dimensions: { equipment: 2, cleanliness: 4, trainers: 4, crowding: 4, facilities: 4 },
      signals: ['out_of_order', 'easy_at_peak'],
      text: 'The treadmill was broken again.',
    },
    {
      at: '2026-08-16T18:40:00+05:30',
      stars: 4,
      dimensions: { equipment: 4, cleanliness: 4, trainers: 4, crowding: 4, facilities: 4 },
      signals: ['easy_at_peak'],
      text: 'Evening slots are much better planned now.',
    },
    {
      at: '2026-08-19T19:55:00+05:30',
      stars: 2,
      dimensions: { equipment: 1, cleanliness: 4, trainers: 4, crowding: 4, facilities: 3 },
      signals: ['out_of_order', 'worn', 'too_hot'],
      text: 'Two treadmills and the cross trainer out of order. Upstairs is stuffy too.',
    },
    {
      at: '2026-08-23T09:30:00+05:30',
      stars: 4,
      dimensions: {},
      signals: [],
      text: '',
    },
    {
      at: '2026-08-26T20:10:00+05:30',
      stars: 3,
      dimensions: { equipment: 2, cleanliness: 4, trainers: 4, crowding: 4, facilities: 4 },
      signals: ['weights_missing', 'worn'],
      text: '',
    },
    {
      at: '2026-08-30T07:20:00+05:30',
      stars: 5,
      dimensions: { equipment: 4, cleanliness: 5, trainers: 5, crowding: 5, facilities: 4 },
      signals: ['good_guidance', 'never_crowded'],
      text: '',
    },
    {
      at: '2026-09-02T19:35:00+05:30',
      stars: 2,
      dimensions: { equipment: 1, cleanliness: 4, trainers: 4, crowding: 4, facilities: 4 },
      signals: ['out_of_order'],
      text: 'Equipment is broken and has been for weeks. Please fix the machines.',
    },
    {
      at: '2026-09-06T18:15:00+05:30',
      stars: 5,
      dimensions: { equipment: 5, cleanliness: 5, trainers: 5, crowding: 5, facilities: 5 },
      signals: ['motivating'],
      text: 'Trainers are great, the new evening slots work.',
    },
    {
      at: '2026-09-10T20:40:00+05:30',
      stars: 3,
      dimensions: { equipment: 2, cleanliness: 4, trainers: 4, crowding: 4, facilities: 4 },
      signals: ['out_of_order'],
      text: 'Cable machine not working again.',
    },
    {
      at: '2026-09-13T07:45:00+05:30',
      stars: 4,
      dimensions: { equipment: 4, cleanliness: 5, trainers: 4, crowding: 4, facilities: 4 },
      signals: ['washroom_clean', 'good_lockers'],
      text: 'Clean and well kept. Good vibe.',
    },
    {
      at: '2026-09-17T19:10:00+05:30',
      stars: 2,
      dimensions: { equipment: 2, cleanliness: 4, trainers: 3, crowding: 4, facilities: 4 },
      signals: ['not_enough', 'none_around'],
      text: 'Broken equipment everywhere and no trainer on the floor tonight.',
    },
  ],
};
