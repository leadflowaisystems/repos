'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/components/portal/locale-provider';

/**
 * "GOOD MORNING" — said on the owner's clock, not the server's.
 *
 * The brief greets the owner by the time of day, which is a small thing that
 * makes the screen feel prepared for them rather than printed. It can only be
 * right in the BROWSER: the server runs in whatever timezone the deployment
 * does, and a "Good morning" at nine at night is worse than no greeting.
 *
 * So the server renders the line empty — at its full height, so the business
 * name under it does not move when the words arrive — and the browser fills
 * it in on its first frame. Before that, and for anyone without JavaScript,
 * the line is a blank space and the name below it still says whose brief this
 * is.
 *
 * Three literal calls rather than a key built from the hour: the workspace
 * ships only the dictionary namespaces its client components read, and the
 * check that keeps that list honest (`tests/perf.workspace-payload.test.ts`)
 * finds keys by reading `t('…')` calls. A key assembled at run time would be
 * invisible to it, and would reach the owner as raw text the day the list
 * drifted.
 */
export function Greeting() {
  const t = useT();
  const [hour, setHour] = useState<number | null>(null);

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  const words =
    hour === null
      ? null
      : hour < 12
        ? t('brief.greeting.morning')
        : hour < 17
          ? t('brief.greeting.afternoon')
          : t('brief.greeting.evening');

  return (
    <p
      className="h-4 text-[11px] leading-4 font-semibold tracking-[0.14em] text-brand-400 uppercase"
      aria-hidden={words === null ? true : undefined}
    >
      {words ?? ' '}
    </p>
  );
}
