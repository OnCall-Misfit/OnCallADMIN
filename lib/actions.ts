'use server';

import { createAdminClient } from './supabase';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { randomBytes } from 'crypto';
import type { SubmissionPayload } from './types';

export type ActionResult = { error: string } | undefined;

export async function createSubmission(data: SubmissionPayload): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { skill_ids, ...submissionData } = data;
  const idempotency_key = randomBytes(32).toString('hex');

  const { data: created, error } = await supabase
    .from('submissions')
    .insert({ ...submissionData, idempotency_key })
    .select('id')
    .single();

  if (error) return { error: error.message };

  if (skill_ids.length > 0) {
    const { error: skillError } = await supabase
      .from('caregiver_skills')
      .insert(skill_ids.map((id) => ({ submission_id: created.id, skill_id: id })));

    if (skillError) return { error: skillError.message };
  }

  redirect('/');
}

export async function updateSubmission(
  id: string,
  data: SubmissionPayload
): Promise<ActionResult> {
  const supabase = createAdminClient();
  const { skill_ids, ...submissionData } = data;

  const { error } = await supabase
    .from('submissions')
    .update({ ...submissionData, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return { error: error.message };

  // Replace skills: delete existing, then insert new
  await supabase.from('caregiver_skills').delete().eq('submission_id', id);

  if (skill_ids.length > 0) {
    const { error: skillError } = await supabase
      .from('caregiver_skills')
      .insert(skill_ids.map((skill_id) => ({ submission_id: id, skill_id })));

    if (skillError) return { error: skillError.message };
  }

  redirect('/');
}

export async function deleteSubmission(id: string): Promise<ActionResult> {
  const supabase = createAdminClient();

  // Delete dependent rows first (no CASCADE defined in schema)
  await supabase.from('caregiver_skills').delete().eq('submission_id', id);
  await supabase.from('ingestion_logs').delete().eq('submission_id', id);

  const { error } = await supabase.from('submissions').delete().eq('id', id);
  if (error) return { error: error.message };

  revalidatePath('/');
}
