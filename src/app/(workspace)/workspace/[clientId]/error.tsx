'use client';

import { Link } from '@/components/portal/link';
import { useParams } from 'next/navigation';
import { useT } from '@/components/portal/locale-provider';

/**
 * When a workspace page fails to render.
 *
 * Calm, and honest about what it knows: the page could not be shown, nothing
 * is lost, and here are two ways on. Like every error surface in RepOS it
 * shows no message, digest or path — the reason belongs in the server log,
 * not on an owner's phone.
 *
 * The words come from the dictionary, so an owner who reads Hindi or Marathi
 * is not dropped back into English at the one moment they are already unsure
 * what happened.
 */
export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  const params = useParams<{ clientId?: string }>();
  const home = params?.clientId ? `/workspace/${params.clientId}` : '/';

  return (
    <div className="mx-auto max-w-xl py-16" role="alert">
      <p className="text-[11px] font-medium tracking-widest text-ink-500 uppercase">
        {t('errors.workspace.eyebrow')}
      </p>
      <h1 className="mt-2 text-[22px] leading-snug font-semibold tracking-tight text-ink-900">
        {t('errors.workspace.headline')}
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-600">
        {t('errors.workspace.reassurance')}
      </p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-11 items-center rounded-lg bg-ink-900 px-4 text-[14px] font-medium text-white hover:bg-ink-800 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {t('errors.workspace.retry')}
        </button>
        <Link
          href={home}
          className="inline-flex min-h-11 items-center rounded-lg border border-ink-300 px-4 text-[14px] font-medium text-ink-900 hover:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-400 focus-visible:outline-none"
        >
          {t('errors.workspace.home')}
        </Link>
      </div>
    </div>
  );
}
