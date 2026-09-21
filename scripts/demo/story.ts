/**
 * THE SHAPE OF A HEADWAY DEMO STORY.
 *
 * Synthetic demo data for product evaluation. A story is a dataset shaped
 * exactly the way the product stores feedback that arrived through its real
 * doors, told in date order:
 *
 *   PUBLIC_REVIEW  a review the operator observed on a public listing and
 *                  pasted in: a star rating (sometimes none), a date, words.
 *   REP_OS_QR      a customer who scanned the business's card: an overall
 *                  rating, a rating for each part of the visit the vertical
 *                  pack asks about, the specifics they tapped when a rating
 *                  was 3 or below, and — for some — a line or two of words.
 *
 * Corner Cafe (`./corner-cafe.ts`) was the first story. The six vertical
 * demos in `./verticals/` use the same shape, so the same seeder drives every
 * one of them through the real intake, snapshot, analysis, context and
 * improvement services.
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
  /** Dimension key → 1–5, keys from the vertical pack's gateway block. */
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

export type DemoStory = {
  businessName: string;
  /** A pack id from /packs. */
  vertical: string;
  /** Public reviews pasted before the first check-in. */
  earlyReviews: PublicReview[];
  firstCheckin: Checkin;
  /** Public reviews pasted between the first check-in and the decision. */
  midReviews: PublicReview[];
  owner: {
    conversation: { at: string; title: string; body: string };
    context: OwnerContextLine[];
    /**
     * The owner's answer to the question Headway asks on Home. Only packs whose
     * issue carries an `askOwner` question can have one.
     */
    answer?: { at: string; themeKey: string; answer: string };
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
  /** What came through the business's own QR card, from the week it went out. */
  qr: QrSubmission[];
};

/** Every piece of feedback in a story. */
export function countStoryFeedback(story: DemoStory): number {
  return (
    story.earlyReviews.length +
    story.firstCheckin.reviews.length +
    story.midReviews.length +
    story.lateReviews.length +
    story.secondCheckin.reviews.length +
    story.qr.length
  );
}
