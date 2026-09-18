import { describe, expect, it } from 'vitest';
import { buildTrends } from './trends';
import type { PortalSignal, PortalView } from './view';

/**
 * TRENDS ARE THE ENGINE'S VERDICTS, SORTED (trends pass).
 *
 * The shelves take the engine's direction as given; this pins that nothing is
 * promoted onto a shelf the engine did not put it on, that the numbers shown are
 * the recorded counts, and that no percentage is made up from nothing.
 */

function signal(
  key: string,
  kind: 'ISSUE' | 'PRAISE',
  direction: PortalSignal['movementDirection'],
  previous: number | null,
  current: number | null,
): PortalSignal {
  return {
    themeKey: key,
    themeLabel: key.toUpperCase(),
    kind,
    movementDirection: direction,
    movementPoints:
      direction !== null && previous !== null && current !== null
        ? { previous, current, previousTotal: 44, currentTotal: 43 }
        : null,
  } as unknown as PortalSignal;
}

function view(unhappy: PortalSignal[], loved: PortalSignal[] = [], early: PortalSignal[] = []): PortalView {
  return { unhappy, loved, early } as unknown as PortalView;
}

describe('buildTrends', () => {
  it('files each topic on the shelf the engine chose, in the order the view gave', () => {
    const trends = buildTrends(
      view(
        [
          signal('waiting', 'ISSUE', 'WORSENING', 14, 20),
          signal('noise', 'ISSUE', 'IMPROVING', 10, 4),
          signal('price', 'ISSUE', 'WORSENING', 3, 9),
          signal('parking', 'ISSUE', 'STABLE', 6, 6),
        ],
        [signal('food', 'PRAISE', 'IMPROVING', 8, 15), signal('staff', 'PRAISE', 'WORSENING', 12, 5)],
      ),
      true,
    );
    expect(trends.worse.map((r) => r.key)).toEqual(['waiting', 'price', 'staff']);
    expect(trends.better.map((r) => r.key)).toEqual(['noise', 'food']);
    expect(trends.stable.map((r) => r.key)).toEqual(['parking']);
  });

  it('carries the recorded counts and a change worked out from them', () => {
    const [row] = buildTrends(view([signal('waiting', 'ISSUE', 'WORSENING', 14, 20)]), true).worse;
    expect(row).toMatchObject({
      previous: 14,
      current: 20,
      previousTotal: 44,
      currentTotal: 43,
      changePct: 43,
      moved: 'UP',
    });
    const [praise] = buildTrends(view([], [signal('staff', 'PRAISE', 'WORSENING', 12, 5)]), true).worse;
    expect(praise).toMatchObject({ kind: 'PRAISE', changePct: -58, moved: 'DOWN' });
  });

  it('shows no percentage when there was nothing before', () => {
    const [row] = buildTrends(view([signal('price', 'ISSUE', 'WORSENING', 0, 7)]), true).worse;
    expect(row!.changePct).toBeNull();
  });

  it('leaves out what the engine could not read, rather than forcing a verdict', () => {
    const trends = buildTrends(
      view([signal('thin', 'ISSUE', null, 1, 2)], [signal('rare', 'PRAISE', null, null, null)]),
      true,
    );
    expect(trends.worse).toEqual([]);
    expect(trends.better).toEqual([]);
    expect(trends.stable).toEqual([]);
  });

  it('never calls common praise "better" unless the engine says it moved', () => {
    const trends = buildTrends(view([], [signal('food', 'PRAISE', 'STABLE', 20, 21)]), true);
    expect(trends.better).toEqual([]);
    expect(trends.stable[0]).toMatchObject({ key: 'food', moved: 'SAME' });
  });

  it('lists a topic once even when the view holds it in two places', () => {
    const waiting = signal('waiting', 'ISSUE', 'WORSENING', 4, 9);
    const trends = buildTrends(view([waiting], [], [waiting]), true);
    expect(trends.worse).toHaveLength(1);
  });

  it('says when there is no second check-in to compare with', () => {
    expect(buildTrends(view([]), false).comparable).toBe(false);
  });
});
