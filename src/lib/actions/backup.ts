'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { createBackup } from '@/lib/backup/service';
import { failure, success, type ActionState } from './shared';
import { adminGate } from '@/lib/auth/guard';

/**
 * Taking a copy of the database, on demand (M16).
 *
 * One action, operator-only. It says plainly whether the copy was written and
 * checked, or exactly what went wrong — no silent success, and no half-written
 * file left behind either way.
 */
export async function takeBackupAction(
  _prev: ActionState,
  _form: FormData,
): Promise<ActionState> {
  const gate = await adminGate();
  if (!gate.ok) return gate.state;

  const result = await createBackup(prisma);
  if (!result.ok) {
    return failure(
      result.detail ? `${result.reason} (${result.detail})` : result.reason,
    );
  }

  revalidatePath('/settings');
  const mb = (result.file.bytes / (1024 * 1024)).toFixed(1);
  const checked =
    result.verified === 'INTEGRITY_CHECK'
      ? 'SQLite checked the copy and reported no problems.'
      : 'The copy was written and is a valid database file.';
  return success(`Saved ${result.file.name} — ${mb} MB. ${checked}`);
}
