import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/forms/account-forms';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Set a new password' };

/**
 * Finishing a reset.
 *
 * Reachable only with the recovery session Supabase establishes when the
 * emailed link is opened. Setting a password also ends every other session
 * that account had open.
 */
export default function ResetPasswordPage() {

  return (
    <main>
      <div className="mb-8 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-md bg-ink-900 text-[15px] font-bold text-white">
          R
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-ink-900">RepOS</span>
      </div>
      <h1 className="text-[24px] leading-[1.2] font-semibold tracking-tight text-ink-900">
        Set a new password
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-600">Choose something you have not used elsewhere.</p>
      <ResetPasswordForm />
      
    </main>
  );
}
