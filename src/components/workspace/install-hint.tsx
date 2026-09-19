'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/components/portal/locale-provider';

/**
 * ADD HEADWAY TO YOUR HOME SCREEN — one quiet row on More (mobile polish pass).
 *
 * Never a popup, never on Home: an owner who wants Headway on their phone finds
 * it where an app keeps its settings, and an owner who does not is never asked.
 *
 * It appears only when it can do something:
 *   - the browser offered to install (Chrome, Edge, Samsung Internet on
 *     Android): the row is a button that opens the browser's own install sheet;
 *   - an iPhone or iPad in the browser, which has no such offer: the row says
 *     the two taps Safari needs;
 *   - anything else, or Headway already running from the home screen: nothing.
 *
 * It renders nothing on the server and nothing until the browser has said
 * which case this is, so the page never shifts for it.
 */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

type Mode = { kind: 'prompt'; event: InstallPrompt } | { kind: 'ios' } | null;

function installed(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallHint() {
  const t = useT();
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    if (installed()) return;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (ios) setMode({ kind: 'ios' });
    const offer = (e: Event) => {
      e.preventDefault();
      setMode({ kind: 'prompt', event: e as InstallPrompt });
    };
    const done = () => setMode(null);
    window.addEventListener('beforeinstallprompt', offer);
    window.addEventListener('appinstalled', done);
    return () => {
      window.removeEventListener('beforeinstallprompt', offer);
      window.removeEventListener('appinstalled', done);
    };
  }, []);

  if (!mode) return null;

  const body = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block text-[16px] font-medium text-ink-900">{t('more.install.title')}</span>
      <span className="mt-0.5 block text-[13px] leading-snug text-ink-500">
        {mode.kind === 'ios' ? t('more.install.ios') : t('more.install.hint')}
      </span>
    </span>
  );

  return (
    <div className="mt-8 overflow-hidden rounded-xl border border-ink-200 bg-white">
      {mode.kind === 'prompt' ? (
        <button
          type="button"
          onClick={async () => {
            await mode.event.prompt();
            await mode.event.userChoice.catch(() => null);
            // The browser offers once per event; after an answer the row goes.
            setMode(null);
          }}
          className="hw-focus-inset flex min-h-15 w-full items-center justify-between gap-4 px-4 py-3 hover:bg-ink-50"
        >
          {body}
          <span aria-hidden className="text-[18px] text-ink-300">
            ›
          </span>
        </button>
      ) : (
        <div className="flex min-h-15 items-center px-4 py-3">{body}</div>
      )}
    </div>
  );
}
