/**
 * WHERE A BUSINESS STANDS WITH HEADWAY, AND WHAT THAT ALLOWS (M28).
 *
 * One pure function decides everything: whether the workspace opens, whether
 * the QR still takes feedback, how many days are left, and which of the seven
 * states the business is in. Every surface — the owner's Account page, the
 * server-side gate, the public QR, the operator's list — reads THIS, so none of
 * them can disagree with another about whether a trial has ended.
 *
 * THE STORED DATES ARE THE SOURCE OF TRUTH. `trialStartsAt` and `trialEndsAt`
 * are read off the row and never recomputed. The installation-wide default in
 * Settings is consulted at exactly one moment — when a trial is STARTED — and
 * what it produces is a date. Changing it later cannot reach a business that
 * already exists, and nothing here would let it: this module never reads
 * AppSetting and takes no database handle at all.
 *
 * WHY THE ARITHMETIC IS IN CALENDAR DAYS, IN ASIA/KOLKATA. "Two days left" is
 * a thing an owner reads on a Tuesday morning and expects to still be true at
 * Tuesday midnight. Subtracting instants and dividing by 86,400,000 gives
 * "1.6 days", which rounds to different answers over the course of one
 * afternoon; a business would watch the number flicker between 2 and 1 while
 * nothing changed. So days are counted as DAYS — the number of midnights
 * between now and the end date, in the timezone every date in Headway is
 * already printed in. India has no daylight saving, so a fixed +05:30 is exact
 * rather than an approximation.
 *
 * EXPIRY ITSELF IS AN INSTANT, not a day. The workspace closes when the clock
 * passes the stored `trialEndsAt`, because that is the boundary the operator
 * set and the one the owner was told. Only the GRACE window is measured in
 * calendar days, because a customer standing at a table with a QR code is not
 * party to a billing conversation and should not meet a dead page halfway
 * through a Tuesday.
 */

const DAY = 86_400_000;

/** India is +05:30 all year. No DST, so this is exact, not an approximation. */
const IST_OFFSET_MS = 330 * 60_000;

/**
 * How many whole days after the trial ends the QR keeps taking feedback.
 *
 * Three, counted the way the brief enumerates them: a trial ending on 1 October
 * leaves the QR live on the 1st, the 2nd and the 3rd, and dark from the 4th.
 * The day of expiry is the first of the three, not the day before them.
 */
export const QR_GRACE_DAYS = 3;

/** Days remaining at which the Account page starts saying something. */
export const WARN_AT_DAYS = 5;
/** And at which it says it more plainly, on Home as well. */
export const WARN_STRONGLY_AT_DAYS = 2;

/**
 * The seven situations a business can be in.
 *
 * ACTIVE_TRIAL     on a trial that has not run out
 * ACTIVE_SERVICE   paying, or otherwise not on a trial clock at all
 * TRIAL_EXPIRED    the trial ran out and nothing is holding the door open
 * MANUALLY_LOCKED  platform staff closed it by hand, whatever the dates say
 * ADMIN_OVERRIDE   platform staff opened it by hand, whatever the dates say
 * FOUNDER_EXEMPT   the person looking is platform staff
 * DEMO_EXEMPT      the demonstration business, which never runs out
 */
export type LifecycleState =
  | 'ACTIVE_TRIAL'
  | 'ACTIVE_SERVICE'
  | 'TRIAL_EXPIRED'
  | 'MANUALLY_LOCKED'
  | 'ADMIN_OVERRIDE'
  | 'FOUNDER_EXEMPT'
  | 'DEMO_EXEMPT';

/** What the Account page is entitled to say, and how loudly. */
export type LifecycleWarning = 'ENDING_SOON' | 'ENDING_IMMINENTLY' | null;

export type LifecycleInput = {
  subscriptionStatus: string;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  /** Set by platform staff. Closes the workspace whatever the dates say. */
  serviceLockedAt?: Date | null;
  /** Set by platform staff. Opens it whatever the dates say. */
  accessOverrideAt?: Date | null;
  /** 'DEMO' for the demonstration business. Not writable by a business. */
  serviceExemption?: string | null;
  /** True only for a signed-in platform admin. Never read from a form. */
  viewerIsPlatformAdmin?: boolean;
  now: Date;
};

export type Lifecycle = {
  state: LifecycleState;
  /** Server-side truth. The gate reads this; nothing in the browser decides it. */
  workspaceLocked: boolean;
  /** Whether the public QR still takes feedback. */
  qrActive: boolean;
  /** The instant the QR goes dark, or null when it never will. */
  qrGraceEndsAt: Date | null;
  /** True while the trial has ended but the QR is still inside its grace. */
  inQrGrace: boolean;
  trialStartsAt: Date | null;
  trialEndsAt: Date | null;
  /** Whole calendar days, in IST. Negative once past. Null with no end date. */
  daysRemaining: number | null;
  /** True once the clock has passed the stored end instant. */
  expired: boolean;
  warning: LifecycleWarning;
  /** True when nothing about a trial applies: paying, exempt, or overridden. */
  exempt: boolean;
};

// ---------------------------------------------------------------------------
// Calendar days, in the timezone Headway prints
// ---------------------------------------------------------------------------

/** Which IST day an instant falls on, numbered from the epoch. */
function istDayNumber(value: Date): number {
  return Math.floor((value.getTime() + IST_OFFSET_MS) / DAY);
}

/** The instant IST midnight begins on a given IST day number. */
function istMidnight(dayNumber: number): Date {
  return new Date(dayNumber * DAY - IST_OFFSET_MS);
}

/**
 * Whole days from `now` to `end`, counted as midnights crossed in IST.
 *
 * Same IST day → 0. Tomorrow → 1. Yesterday → -1. Deliberately independent of
 * the time of day at either end, so the number an owner reads in the morning is
 * the number they read that night.
 */
export function calendarDaysBetween(now: Date, end: Date): number {
  return istDayNumber(end) - istDayNumber(now);
}

/**
 * When the QR goes dark: IST midnight at the start of the day AFTER the last
 * live one. Expiry on the 1st → live through the 3rd → dark from the 4th.
 */
export function qrGraceEnd(trialEndsAt: Date): Date {
  return istMidnight(istDayNumber(trialEndsAt) + QR_GRACE_DAYS);
}

// ---------------------------------------------------------------------------
// The decision
// ---------------------------------------------------------------------------

/**
 * Everything the rest of Headway needs to know about one business, from facts
 * it already holds. Pure: no database handle, no settings lookup, no clock of
 * its own. `now` is passed in so every surface in one render judges against a
 * single instant, and so the tests can stand on any date they like.
 *
 * The order below is the precedence, and it is deliberate:
 *
 *   1. A PLATFORM ADMIN looking at a workspace is never shut out of it. They
 *      are the person who would have to fix whatever is wrong.
 *   2. THE DEMONSTRATION BUSINESS never runs out, because it is the thing
 *      shown to people who have not bought anything yet.
 *   3. A MANUAL LOCK beats the dates, in the closing direction.
 *   4. AN ADMIN OVERRIDE beats the dates, in the opening direction. It cannot
 *      collide with a lock: setting either one clears the other, in the one
 *      function allowed to write them.
 *   5. A PAYING ACCOUNT is not on a trial clock and is never counted down at.
 *   6. Otherwise the stored dates decide.
 */
export function describeLifecycle(input: LifecycleInput): Lifecycle {
  const { now, trialStartsAt = null, trialEndsAt = null } = input;
  const daysRemaining = trialEndsAt ? calendarDaysBetween(now, trialEndsAt) : null;
  const expired = trialEndsAt !== null && now.getTime() >= trialEndsAt.getTime();
  const graceEndsAt = trialEndsAt ? qrGraceEnd(trialEndsAt) : null;

  const open = (state: LifecycleState): Lifecycle => ({
    state,
    workspaceLocked: false,
    qrActive: true,
    qrGraceEndsAt: null,
    inQrGrace: false,
    trialStartsAt,
    trialEndsAt,
    daysRemaining,
    expired,
    warning: null,
    exempt: true,
  });

  // 1. Platform staff are never locked out of a workspace they can already reach.
  if (input.viewerIsPlatformAdmin) return open('FOUNDER_EXEMPT');

  // 2. The demonstration business never runs out, and its QR never goes dark.
  if ((input.serviceExemption ?? null) === 'DEMO') return open('DEMO_EXEMPT');

  // 3. Closed by hand.
  if (input.serviceLockedAt) {
    return {
      state: 'MANUALLY_LOCKED',
      workspaceLocked: true,
      // A lock is a commercial decision between Headway and the business. The
      // customer at the table is not part of it, so the QR follows the trial
      // dates exactly as it otherwise would.
      qrActive: !expired || (graceEndsAt !== null && now.getTime() < graceEndsAt.getTime()),
      qrGraceEndsAt: graceEndsAt,
      inQrGrace: expired && graceEndsAt !== null && now.getTime() < graceEndsAt.getTime(),
      trialStartsAt,
      trialEndsAt,
      daysRemaining,
      expired,
      warning: null,
      exempt: false,
    };
  }

  // 4. Opened by hand.
  if (input.accessOverrideAt) return open('ADMIN_OVERRIDE');

  // 5. Paying, paused or closed: not on a trial clock. Pause already has its
  //    own banner and its own rules, and neither is this module's business.
  const status = (input.subscriptionStatus ?? '').trim();
  if (status !== 'TRIAL') return open('ACTIVE_SERVICE');

  // 6. A trial with no end date cannot expire. Only a business created before
  //    every trial carried a window, and only until it is given one.
  if (trialEndsAt === null) return open('ACTIVE_TRIAL');

  if (expired) {
    const inGrace = graceEndsAt !== null && now.getTime() < graceEndsAt.getTime();
    return {
      state: 'TRIAL_EXPIRED',
      workspaceLocked: true,
      qrActive: inGrace,
      qrGraceEndsAt: graceEndsAt,
      inQrGrace: inGrace,
      trialStartsAt,
      trialEndsAt,
      daysRemaining,
      expired: true,
      warning: null,
      exempt: false,
    };
  }

  const left = daysRemaining ?? 0;
  return {
    state: 'ACTIVE_TRIAL',
    workspaceLocked: false,
    qrActive: true,
    qrGraceEndsAt: graceEndsAt,
    inQrGrace: false,
    trialStartsAt,
    trialEndsAt,
    daysRemaining,
    expired: false,
    warning:
      left <= WARN_STRONGLY_AT_DAYS
        ? 'ENDING_IMMINENTLY'
        : left <= WARN_AT_DAYS
          ? 'ENDING_SOON'
          : null,
    exempt: false,
  };
}

// ---------------------------------------------------------------------------
// What each state is called, for the people who read it
// ---------------------------------------------------------------------------

/** The owner's own words for where they stand. Never a countdown in hours. */
export function statusLabel(lifecycle: Lifecycle): string {
  switch (lifecycle.state) {
    case 'ACTIVE_TRIAL':
      return 'Active trial';
    case 'ACTIVE_SERVICE':
      return 'Active service';
    case 'TRIAL_EXPIRED':
      return 'Trial ended';
    case 'MANUALLY_LOCKED':
      return 'On hold';
    case 'ADMIN_OVERRIDE':
      return 'Active service';
    case 'FOUNDER_EXEMPT':
      return 'Headway staff access';
    case 'DEMO_EXEMPT':
      return 'Demonstration workspace';
  }
}

/** The operator's shorter word for the same thing, for the client list. */
export function operatorLabel(lifecycle: Lifecycle): string {
  switch (lifecycle.state) {
    case 'ACTIVE_TRIAL':
      return lifecycle.warning ? 'Trial ending soon' : 'Active trial';
    case 'ACTIVE_SERVICE':
      return 'Active';
    case 'TRIAL_EXPIRED':
      return lifecycle.inQrGrace ? 'Expired · QR in grace' : 'Expired';
    case 'MANUALLY_LOCKED':
      return 'Locked by hand';
    case 'ADMIN_OVERRIDE':
      return 'Access override';
    case 'FOUNDER_EXEMPT':
      return 'Staff';
    case 'DEMO_EXEMPT':
      return 'Demo';
  }
}
