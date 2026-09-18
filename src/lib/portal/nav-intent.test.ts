import { describe, expect, it } from 'vitest';
import { doorIntent, placeOf, sectionOf, stepsBackTo, upIntent, type HistoryView, type NavIntent } from './nav-intent';

/**
 * WHAT A TAP DOES TO THE BROWSER'S HISTORY (mobile back-navigation pass).
 *
 * The rules are pure, so they are tested the way a browser would exercise
 * them: a model of the session history — entries and a current index, with
 * push discarding everything forward of here, replace swapping one entry,
 * and Back/Forward moving the index — driven through the same intents the
 * bottom bar and the in-page back links compute. The owner's own script is
 * then walked end to end, and the address checked after every step.
 */

const BASE = '/workspace/cl123';

/** The browser's session history, as far as these rules can see it. */
class Session {
  entries: string[];
  index: number;

  constructor(start: string[]) {
    this.entries = [...start];
    this.index = start.length - 1;
  }

  get here(): string {
    return this.entries[this.index]!;
  }

  /** Same-origin, contiguous entries only — what `navigation.entries()` returns. */
  view(): HistoryView {
    let from = this.index;
    while (from > 0 && this.entries[from - 1]!.startsWith('/')) from -= 1;
    let to = this.index;
    while (to < this.entries.length - 1 && this.entries[to + 1]!.startsWith('/')) to += 1;
    return { entries: this.entries.slice(from, to + 1), index: this.index - from };
  }

  push(url: string) {
    this.entries = [...this.entries.slice(0, this.index + 1), url];
    this.index += 1;
  }

  replace(url: string) {
    this.entries[this.index] = url;
  }

  go(delta: number) {
    const next = this.index + delta;
    if (next < 0 || next >= this.entries.length) throw new Error(`no entry at ${delta}`);
    this.index = next;
  }

  back() {
    this.go(-1);
  }

  forward() {
    this.go(1);
  }

  apply(intent: NavIntent, url: string) {
    switch (intent.kind) {
      case 'STAY':
        return;
      case 'TRAVERSE':
        return this.go(intent.delta);
      case 'PUSH':
        return this.push(url);
      case 'REPLACE':
        return this.replace(url);
    }
  }

  /** A bottom-bar door. */
  door(slug: '' | 'reviews' | 'improvements' | 'more') {
    const href = slug ? `${BASE}/${slug}` : BASE;
    this.apply(doorIntent({ door: href, current: this.here, basePath: BASE, history: this.view() }), href);
  }

  /** An in-page "← …" link up to a parent. */
  up(parent: string) {
    this.apply(upIntent({ parent, basePath: BASE, history: this.view() }), parent);
  }

  /** An ordinary link one step deeper. */
  open(url: string) {
    this.push(url);
  }
}

const HOME = BASE;
const FEEDBACK = `${BASE}/reviews`;
const TOPIC = `${BASE}/reviews?theme=wait_time`;
const ENTRY = `${BASE}/reviews/rv000000001?topic=wait_time`;
const IMPROVEMENTS = `${BASE}/improvements`;
const CHANGE = `${BASE}/improvements/ac000000001`;
const MORE = `${BASE}/more`;
const ACCOUNT = `${BASE}/account`;
/** Where the owner was before Headway: another site, in another origin. */
const OUTSIDE = 'https://www.google.com/search?q=headway';

describe('addresses', () => {
  it('compares places by path and query, never by origin or scroll position', () => {
    expect(placeOf('https://headway.example/workspace/cl123/reviews?theme=x#entries')).toBe('/workspace/cl123/reviews?theme=x');
    expect(placeOf('/workspace/cl123/reviews?')).toBe('/workspace/cl123/reviews');
    expect(placeOf('/workspace/cl123')).toBe('/workspace/cl123');
  });

  it('knows which door an address belongs to', () => {
    expect(sectionOf(HOME, BASE)).toBe('');
    expect(sectionOf(TOPIC, BASE)).toBe('reviews');
    expect(sectionOf(ENTRY, BASE)).toBe('reviews');
    expect(sectionOf(CHANGE, BASE)).toBe('improvements');
    expect(sectionOf(ACCOUNT, BASE)).toBe('account');
  });

  it('never walks back past a page that is not this workspace', () => {
    const history: HistoryView = { entries: [HOME, '/login', FEEDBACK], index: 2 };
    expect(stepsBackTo(HOME, BASE, history)).toBeNull();
    const other: HistoryView = { entries: [HOME, '/workspace/clOTHER', FEEDBACK], index: 2 };
    expect(stepsBackTo(HOME, BASE, other)).toBeNull();
  });
});

describe('the four doors', () => {
  it('does nothing to history when the door is where you already are', () => {
    expect(doorIntent({ door: FEEDBACK, current: `${FEEDBACK}#entries`, basePath: BASE, history: null })).toEqual({ kind: 'STAY' });
  });

  it('goes BACK to Home when Home is behind you, however deep you are', () => {
    const history: HistoryView = { entries: [HOME, FEEDBACK, TOPIC, ENTRY], index: 3 };
    expect(doorIntent({ door: HOME, current: ENTRY, basePath: BASE, history })).toEqual({ kind: 'TRAVERSE', delta: -3 });
  });

  it('goes back to a door\'s own list from a page inside it', () => {
    const history: HistoryView = { entries: [HOME, IMPROVEMENTS, CHANGE], index: 2 };
    expect(doorIntent({ door: IMPROVEMENTS, current: CHANGE, basePath: BASE, history })).toEqual({ kind: 'TRAVERSE', delta: -1 });
  });

  it('steps deeper from Home, and moves sideways between the other doors', () => {
    const history: HistoryView = { entries: [HOME], index: 0 };
    expect(doorIntent({ door: FEEDBACK, current: HOME, basePath: BASE, history })).toEqual({ kind: 'PUSH' });
    const sideways: HistoryView = { entries: [HOME, FEEDBACK], index: 1 };
    expect(doorIntent({ door: IMPROVEMENTS, current: FEEDBACK, basePath: BASE, history: sideways })).toEqual({ kind: 'REPLACE' });
  });

  it('makes Home the root when it is not behind you, so Back from it leaves', () => {
    // Opened straight onto Feedback from a link: Home replaces it.
    const history: HistoryView = { entries: [FEEDBACK], index: 0 };
    expect(doorIntent({ door: HOME, current: FEEDBACK, basePath: BASE, history })).toEqual({ kind: 'REPLACE' });
  });

  it('behaves as an ordinary link where the browser cannot show its history', () => {
    expect(doorIntent({ door: HOME, current: FEEDBACK, basePath: BASE, history: null })).toEqual({ kind: 'PUSH' });
    expect(doorIntent({ door: FEEDBACK, current: HOME, basePath: BASE, history: null })).toEqual({ kind: 'PUSH' });
    // Sideways still replaces: that rule needs no history, only where you are.
    expect(doorIntent({ door: MORE, current: IMPROVEMENTS, basePath: BASE, history: null })).toEqual({ kind: 'REPLACE' });
  });
});

describe('the in-page way back', () => {
  it('is the browser\'s Back when the page it names is right behind', () => {
    const history: HistoryView = { entries: [HOME, FEEDBACK, TOPIC, ENTRY], index: 3 };
    expect(upIntent({ parent: TOPIC, basePath: BASE, history })).toEqual({ kind: 'TRAVERSE', delta: -1 });
  });

  it('replaces this page with its parent when the owner arrived some other way', () => {
    const history: HistoryView = { entries: [HOME, TOPIC], index: 1 };
    expect(upIntent({ parent: FEEDBACK, basePath: BASE, history })).toEqual({ kind: 'REPLACE' });
  });

  it('is an ordinary link where the browser cannot show its history', () => {
    expect(upIntent({ parent: FEEDBACK, basePath: BASE, history: null })).toEqual({ kind: 'PUSH' });
  });
});

describe('the owner\'s own script, end to end', () => {
  it('walks Home → Feedback → topic → entry → Back → Back → Improvements → change → Back → More → Account → Back → Back → Home → Back', () => {
    const s = new Session([OUTSIDE, HOME]);
    const trail: string[] = [];
    const step = (label: string, run: () => void, expected: string) => {
      run();
      trail.push(label);
      expect(s.here, `after: ${trail.join(' → ')}`).toBe(expected);
    };

    step('1 Home', () => {}, HOME);
    step('2 Feedback', () => s.door('reviews'), FEEDBACK);
    step('3 select theme', () => s.open(TOPIC), TOPIC);
    step('4 open feedback', () => s.open(ENTRY), ENTRY);
    step('5 Back', () => s.back(), TOPIC);
    step('6 Back', () => s.back(), FEEDBACK);
    step('7 Improvements', () => s.door('improvements'), IMPROVEMENTS);
    step('8 open improvement', () => s.open(CHANGE), CHANGE);
    step('9 Back', () => s.back(), IMPROVEMENTS);
    step('10 More', () => s.door('more'), MORE);
    step('11 Account', () => s.open(ACCOUNT), ACCOUNT);
    step('12 Back', () => s.back(), MORE);
    step('13 Back', () => s.back(), HOME);
    step('14 Home', () => s.door(''), HOME);
    // 15: Back from the root leaves Headway, the way the owner came in.
    step('15 Back from root', () => s.back(), OUTSIDE);
  });

  it('never grows history as the owner taps round the doors', () => {
    const s = new Session([OUTSIDE, HOME]);
    for (let round = 0; round < 10; round += 1) {
      s.door('reviews');
      s.door('improvements');
      s.door('more');
    }
    // Home, and the one door the owner is on. One Back is Home.
    expect(s.entries).toEqual([OUTSIDE, HOME, MORE]);
    s.back();
    expect(s.here).toBe(HOME);
  });

  it('never adds a duplicate entry for a door tapped twice', () => {
    const s = new Session([OUTSIDE, HOME]);
    s.door('reviews');
    s.door('reviews');
    s.door('reviews');
    expect(s.entries).toEqual([OUTSIDE, HOME, FEEDBACK]);
  });

  it('takes Home from deep inside a door back to the Home entry, not to a copy of it', () => {
    const s = new Session([OUTSIDE, HOME]);
    s.door('reviews');
    s.open(TOPIC);
    s.open(ENTRY);
    s.door('');
    expect(s.here).toBe(HOME);
    expect(s.index).toBe(1);
    // And Back from there leaves, rather than walking back into Feedback.
    s.back();
    expect(s.here).toBe(OUTSIDE);
  });

  it('keeps Forward working after Back, as a browser does', () => {
    const s = new Session([OUTSIDE, HOME]);
    s.door('reviews');
    s.open(TOPIC);
    s.back();
    s.forward();
    expect(s.here).toBe(TOPIC);
  });

  it('lets the in-page way back and the browser\'s Back agree', () => {
    const s = new Session([OUTSIDE, HOME]);
    s.door('reviews');
    s.open(TOPIC);
    s.open(ENTRY);
    s.up(TOPIC); // "← Waiting time" is Back
    expect(s.here).toBe(TOPIC);
    s.up(FEEDBACK); // "← All topics" is Back
    expect(s.here).toBe(FEEDBACK);
    s.back();
    expect(s.here).toBe(HOME);
  });

  it('leaves the app from Home when Headway was opened straight onto a deep page', () => {
    // An owner taps a link to one entry in a message: no Home behind it.
    const s = new Session([OUTSIDE, ENTRY]);
    s.door(''); // Home takes the entry's place…
    expect(s.here).toBe(HOME);
    s.back(); // …so Back from Home leaves, instead of reopening the entry.
    expect(s.here).toBe(OUTSIDE);
  });
});
