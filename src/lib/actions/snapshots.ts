'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { createSnapshot, deleteSnapshot } from '@/lib/snapshots/service';
import {
  failure,
  optDate,
  optInt,
  optNum,
  optStr,
  str,
  strList,
  text,
  type ActionState,
} from './shared';

/**
 * Snapshot server actions.
 *
 * Thin wrappers over src/lib/snapshots/service.ts. Everything the snapshot
 * records is typed in by the operator — RepOS fetches nothing and posts
 * nowhere.
 */

function readSnapshotForm(form: FormData) {
  return {
    label: optStr(form, 'label'),
    capturedAt: optDate(form, 'capturedAt') ?? new Date(Number.NaN),
    rating: optNum(form, 'rating'),
    reviewCount: optInt(form, 'reviewCount'),
    unansweredCount: optInt(form, 'unansweredCount'),
    daysSinceLastPost: optInt(form, 'daysSinceLastPost'),
    photoRecencyDays: optInt(form, 'photoRecencyDays'),
    reviewsPerWeek: optNum(form, 'reviewsPerWeek'),
    profileGaps: strList(form, 'profileGaps'),
    observationNotes: text(form, 'observationNotes'),
    reviewsRaw: text(form, 'reviewsRaw'),
  };
}

export async function createSnapshotAction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const clientId = str(form, 'clientId');
  if (!clientId) return failure('Missing client id.');

  const result = await createSnapshot(prisma, clientId, readSnapshotForm(form));
  if (!result.ok) return failure(result.message, result.errors);

  revalidatePath('/');
  revalidatePath('/clients');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/snapshots`);
  redirect(`/clients/${clientId}/snapshots/${result.data.id}`);
}

export async function deleteSnapshotAction(form: FormData): Promise<void> {
  const clientId = str(form, 'clientId');
  const snapshotId = str(form, 'snapshotId');
  if (!clientId || !snapshotId) return;

  await deleteSnapshot(prisma, clientId, snapshotId);

  revalidatePath('/');
  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/snapshots`);
  redirect(`/clients/${clientId}/snapshots?deleted=1`);
}
