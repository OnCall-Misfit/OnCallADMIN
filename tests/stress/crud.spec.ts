/**
 * Phase 1 — Baseline CRUD Correctness
 *
 * Sequential tests that each own their data and verify the full round-trip:
 *   CREATE → READ single → READ list (pagination) → UPDATE → DELETE → integrity check
 *
 * All inserted rows use the __STRESS_TEST__ prefix.
 * afterAll cleans everything up regardless of pass/fail.
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import {
  getSupabaseClient,
  makePayload,
  insertSubmission,
  cleanupTestData,
} from './helpers';

const supabase = getSupabaseClient();

test.describe('Phase 1 — Baseline CRUD Correctness', () => {
  test.afterAll(async () => {
    await cleanupTestData(supabase);
  });

  // -------------------------------------------------------------------------
  // CREATE
  // -------------------------------------------------------------------------

  test('CREATE — inserts row with 64-char hex idempotency_key', async () => {
    const payload = makePayload();

    // Grab up to 2 real skill IDs from the production lookup table.
    const { data: skillDefs } = await supabase
      .from('skill_definitions')
      .select('id')
      .limit(2);
    const skill_ids = (skillDefs ?? []).map((s: { id: number }) => s.id);
    payload.skill_ids = skill_ids;

    const id = await insertSubmission(supabase, payload);

    // Verify the submissions row.
    const { data: row, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    expect(error).toBeNull();
    expect(row).not.toBeNull();
    expect(row.first_name).toBe(payload.first_name);
    expect(row.last_name).toBe(payload.last_name);
    expect(row.status).toBe('received');
    expect(row.birthdate).toBe('1998-04-21');
    expect(row.location).toBe('Manila, Philippines');
    expect(row.pay_rate).toBe(600);
    expect(row.pay_period).toBe('day');
    expect(row.availability).toBe('immediate');

    // idempotency_key = randomBytes(32).toString('hex') → 64 chars.
    expect(typeof row.idempotency_key).toBe('string');
    expect(row.idempotency_key).toHaveLength(64);
    expect(row.idempotency_key).toMatch(/^[0-9a-f]{64}$/);

    // Verify caregiver_skills rows were created.
    if (skill_ids.length > 0) {
      const { data: skills } = await supabase
        .from('caregiver_skills')
        .select('skill_id')
        .eq('submission_id', id);

      expect((skills ?? []).length).toBe(skill_ids.length);
      const returned = (skills ?? [])
        .map((s: { skill_id: number }) => s.skill_id)
        .sort((a: number, b: number) => a - b);
      expect(returned).toEqual([...skill_ids].sort((a, b) => a - b));
    }
  });

  // -------------------------------------------------------------------------
  // READ — single row
  // -------------------------------------------------------------------------

  test('READ single — all fields round-trip, JSONB work_history intact', async () => {
    const payload = makePayload({
      work_history: [
        { employer_name: 'Clinic A', job_title: 'Nurse', start_date: '2023-01-01', end_date: '2024-01-01', job_description: 'ICU.', currently_employed: false },
        { employer_name: 'Hospital B', job_title: 'Caregiver', start_date: '2024-01-01', end_date: null, job_description: 'Elderly care.', currently_employed: true },
      ],
      pay_rate: 750,
      pay_period: 'hour',
      availability: '1 week notice',
      has_nbi_clearance: true,
      years_of_experience: 5,
    });

    const id = await insertSubmission(supabase, payload);

    const { data: row, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    expect(error).toBeNull();
    expect(row.work_history).toHaveLength(2);
    expect(row.work_history[0].employer_name).toBe('Clinic A');
    expect(row.work_history[0].job_title).toBe('Nurse');
    expect(row.work_history[1].employer_name).toBe('Hospital B');
    expect(row.work_history[1].job_description).toBe('Elderly care.');
    expect(row.pay_rate).toBe(750);
    expect(row.pay_period).toBe('hour');
    expect(row.availability).toBe('1 week notice');
    expect(row.has_nbi_clearance).toBe(true);
    expect(row.years_of_experience).toBe(5);
  });

  // -------------------------------------------------------------------------
  // READ — list / pagination
  // -------------------------------------------------------------------------

  test('READ list — pagination returns correct slice, ordering is descending', async () => {
    // Insert 3 rows with a small delay between each so created_at differs.
    const inserted: string[] = [];
    for (let i = 0; i < 3; i++) {
      const id = await insertSubmission(
        supabase,
        makePayload({ last_name: `Page-${i}-${Date.now()}` })
      );
      inserted.push(id);
      // Small pause so timestamps are distinct on the free tier.
      await new Promise((r) => setTimeout(r, 50));
    }

    // Fetch first page (2 rows) ordered newest-first.
    const { data: page1, error: e1 } = await supabase
      .from('submissions')
      .select('id, first_name, last_name, created_at')
      .ilike('last_name', 'Page-%')
      .order('created_at', { ascending: false })
      .range(0, 1);

    expect(e1).toBeNull();
    expect(page1).not.toBeNull();
    expect(page1!.length).toBe(2);

    // First item must be >= second item (descending order).
    const t0 = new Date(page1![0].created_at).getTime();
    const t1 = new Date(page1![1].created_at).getTime();
    expect(t0).toBeGreaterThanOrEqual(t1);

    // Fetch second page (1 row).
    const { data: page2, error: e2 } = await supabase
      .from('submissions')
      .select('id, first_name, last_name, created_at')
      .ilike('last_name', 'Page-%')
      .order('created_at', { ascending: false })
      .range(2, 2);

    expect(e2).toBeNull();
    expect(page2!.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------------------------

  test('UPDATE — changed fields persist, caregiver_skills fully replaced', async () => {
    // Start with 0 skills.
    const id = await insertSubmission(supabase, makePayload({ skill_ids: [] }));

    // Fetch up to 2 skill IDs to assign after update.
    const { data: skillDefs } = await supabase
      .from('skill_definitions')
      .select('id')
      .limit(2);
    const newSkillIds = (skillDefs ?? []).map((s: { id: number }) => s.id);

    // Update the row (mirrors updateSubmission action, minus redirect).
    const updatedLastName = `Updated-${Date.now()}`;
    const { error: updateError } = await supabase
      .from('submissions')
      .update({
        first_name: '__STRESS_TEST__',
        last_name: updatedLastName,
        status: 'processed',
        pay_rate: 999,
        pay_period: 'month',
        availability: '2 weeks notice',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    expect(updateError).toBeNull();

    // Replace caregiver_skills (delete-then-insert pattern from actions.ts).
    await supabase.from('caregiver_skills').delete().eq('submission_id', id);
    if (newSkillIds.length > 0) {
      const { error: skillErr } = await supabase
        .from('caregiver_skills')
        .insert(newSkillIds.map((skill_id) => ({ submission_id: id, skill_id })));
      expect(skillErr).toBeNull();
    }

    // Verify all changes persisted.
    const { data: updated, error: readErr } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    expect(readErr).toBeNull();
    expect(updated.first_name).toBe('__STRESS_TEST__');
    expect(updated.last_name).toBe(updatedLastName);
    expect(updated.status).toBe('processed');
    expect(updated.pay_rate).toBe(999);
    expect(updated.pay_period).toBe('month');
    expect(updated.availability).toBe('2 weeks notice');

    // Skills replaced correctly.
    const { data: skills } = await supabase
      .from('caregiver_skills')
      .select('skill_id')
      .eq('submission_id', id);
    expect((skills ?? []).length).toBe(newSkillIds.length);
  });

  // -------------------------------------------------------------------------
  // DELETE
  // -------------------------------------------------------------------------

  test('DELETE — row is removed from submissions table', async () => {
    const id = await insertSubmission(supabase, makePayload());

    // Delete in the same order as deleteSubmission action.
    await supabase.from('caregiver_skills').delete().eq('submission_id', id);
    await supabase.from('ingestion_logs').delete().eq('submission_id', id);
    const { error } = await supabase.from('submissions').delete().eq('id', id);

    expect(error).toBeNull();

    // Row must be gone.
    const { data: gone } = await supabase
      .from('submissions')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    expect(gone).toBeNull();
  });

  // -------------------------------------------------------------------------
  // REFERENTIAL INTEGRITY
  // -------------------------------------------------------------------------

  test('REFERENTIAL INTEGRITY — no orphan caregiver_skills after delete', async () => {
    const { data: skillDefs } = await supabase
      .from('skill_definitions')
      .select('id')
      .limit(2);
    const skill_ids = (skillDefs ?? []).map((s: { id: number }) => s.id);

    const id = await insertSubmission(supabase, makePayload({ skill_ids }));

    // Confirm skills exist before delete.
    const { data: before } = await supabase
      .from('caregiver_skills')
      .select('skill_id')
      .eq('submission_id', id);
    expect((before ?? []).length).toBe(skill_ids.length);

    // Delete everything.
    await supabase.from('caregiver_skills').delete().eq('submission_id', id);
    await supabase.from('ingestion_logs').delete().eq('submission_id', id);
    await supabase.from('submissions').delete().eq('id', id);

    // Zero orphans remain.
    const { data: after } = await supabase
      .from('caregiver_skills')
      .select('skill_id')
      .eq('submission_id', id);
    expect(after ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // CREATE → UPDATE → DELETE full lifecycle
  // -------------------------------------------------------------------------

  test('FULL LIFECYCLE — create, update, then delete a single submission', async () => {
    // 1. Create
    const id = await insertSubmission(supabase, makePayload({ status: 'received' }));

    let { data: row } = await supabase
      .from('submissions')
      .select('status')
      .eq('id', id)
      .single();
    expect(row!.status).toBe('received');

    // 2. Update
    await supabase
      .from('submissions')
      .update({ status: 'processed', updated_at: new Date().toISOString() })
      .eq('id', id);

    ({ data: row } = await supabase
      .from('submissions')
      .select('status')
      .eq('id', id)
      .single());
    expect(row!.status).toBe('processed');

    // 3. Delete
    await supabase.from('caregiver_skills').delete().eq('submission_id', id);
    await supabase.from('ingestion_logs').delete().eq('submission_id', id);
    await supabase.from('submissions').delete().eq('id', id);

    const { data: gone } = await supabase
      .from('submissions')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    expect(gone).toBeNull();
  });
});
