/**
 * Phase 3 — Edge Cases & Error Conditions
 *
 * Tests boundary values, constraint violations, and graceful handling of
 * bad input.  Each test verifies that the DB behaves correctly (rejects what
 * it should, accepts what it should) without crashing or producing silent
 * data corruption.
 *
 * Scenarios:
 *   - Duplicate idempotency_key (unique constraint)
 *   - Missing required NOT NULL field (name)
 *   - Invalid enum values (status, pay_period, availability)
 *   - Empty work_history JSONB array
 *   - Oversized work_history (50 entries)
 *   - All optional fields set to null
 *   - FK violation on skill_id
 *   - Update of a non-existent UUID
 *   - Delete of a non-existent UUID (idempotency)
 *   - Integer boundary values for age
 */

import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import {
  getSupabaseClient,
  makePayload,
  insertSubmission,
  cleanupTestData,
  makeOversizedWorkHistory,
} from './helpers';

const supabase = getSupabaseClient();

test.describe('Phase 3 — Edge Cases & Error Conditions', () => {
  test.afterAll(async () => {
    await cleanupTestData(supabase);
  });

  // -------------------------------------------------------------------------
  // Unique constraint
  // -------------------------------------------------------------------------

  test('DUPLICATE idempotency_key — unique constraint blocks re-insert', async () => {
    const key = randomBytes(32).toString('hex');
    const { skill_ids: _sk1, ...data1 } = makePayload();

    // First insert must succeed.
    const { error: e1 } = await supabase
      .from('submissions')
      .insert({ ...data1, idempotency_key: key });
    expect(e1).toBeNull();

    // Second insert with the same key must fail.
    const { skill_ids: _sk2, ...data2 } = makePayload();
    const { error: e2 } = await supabase
      .from('submissions')
      .insert({ ...data2, idempotency_key: key });

    expect(e2).not.toBeNull();
    // Supabase/PostgREST returns the Postgres error message.
    expect(e2!.message.toLowerCase()).toMatch(/duplicate|unique|already exists/i);
  });

  // -------------------------------------------------------------------------
  // NOT NULL constraint
  // -------------------------------------------------------------------------

  test('NULL name — insert rejected by NOT NULL constraint', async () => {
    const { skill_ids, ...rest } = makePayload();
    const { error } = await supabase
      .from('submissions')
      .insert({ ...rest, name: null, idempotency_key: randomBytes(32).toString('hex') });

    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // Enum violations
  // -------------------------------------------------------------------------

  test('INVALID status enum ("ghost") — PostgREST rejects', async () => {
    const { skill_ids, ...rest } = makePayload();
    const { error } = await supabase
      .from('submissions')
      .insert({
        ...rest,
        status: 'ghost' as 'received',
        idempotency_key: randomBytes(32).toString('hex'),
      });

    expect(error).not.toBeNull();
  });

  test('INVALID pay_period enum ("weekly") — PostgREST rejects', async () => {
    const { skill_ids, ...rest } = makePayload();
    const { error } = await supabase
      .from('submissions')
      .insert({
        ...rest,
        pay_period: 'weekly' as 'hour',
        idempotency_key: randomBytes(32).toString('hex'),
      });

    expect(error).not.toBeNull();
  });

  test('INVALID availability enum ("whenever") — PostgREST rejects', async () => {
    const { skill_ids, ...rest } = makePayload();
    const { error } = await supabase
      .from('submissions')
      .insert({
        ...rest,
        availability: 'whenever' as 'immediate',
        idempotency_key: randomBytes(32).toString('hex'),
      });

    expect(error).not.toBeNull();
  });

  // -------------------------------------------------------------------------
  // JSONB edge cases
  // -------------------------------------------------------------------------

  test('EMPTY work_history [] — accepted and round-trips as empty array', async () => {
    const id = await insertSubmission(supabase, makePayload({ work_history: [] }));

    const { data: row, error } = await supabase
      .from('submissions')
      .select('work_history')
      .eq('id', id)
      .single();

    expect(error).toBeNull();
    expect(Array.isArray(row!.work_history)).toBe(true);
    expect(row!.work_history).toHaveLength(0);
  });

  test('OVERSIZED work_history (50 entries × ~750 bytes each) — full integrity', async () => {
    const bigHistory = makeOversizedWorkHistory(50);
    const id = await insertSubmission(supabase, makePayload({ work_history: bigHistory }));

    const { data: row, error } = await supabase
      .from('submissions')
      .select('work_history')
      .eq('id', id)
      .single();

    expect(error).toBeNull();
    expect(row!.work_history).toHaveLength(50);

    // Spot-check first and last entries for data integrity.
    expect(row!.work_history[0].employer_name).toBe(bigHistory[0].employer_name);
    expect(row!.work_history[0].job_description).toBe(bigHistory[0].job_description);
    expect(row!.work_history[49].employer_name).toBe(bigHistory[49].employer_name);
    expect(row!.work_history[49].job_description).toBe(bigHistory[49].job_description);
  });

  // -------------------------------------------------------------------------
  // Nullable optional fields
  // -------------------------------------------------------------------------

  test('ALL optional fields null — accepted without error', async () => {
    const id = await insertSubmission(
      supabase,
      makePayload({
        valid_id_image_url: null,
        nbi_clearance_image_url: null,
        barangay_clearance_image_url: null,
        tesda_nc2_image_url: null,
        submitted_at: null,
        error_message: null,
        pay_rate: null,
        pay_period: null,
        availability: null,
      })
    );

    const { data: row, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('id', id)
      .single();

    expect(error).toBeNull();
    expect(row!.valid_id_image_url).toBeNull();
    expect(row!.nbi_clearance_image_url).toBeNull();
    expect(row!.barangay_clearance_image_url).toBeNull();
    expect(row!.tesda_nc2_image_url).toBeNull();
    expect(row!.submitted_at).toBeNull();
    expect(row!.error_message).toBeNull();
    expect(row!.pay_rate).toBeNull();
    expect(row!.pay_period).toBeNull();
    expect(row!.availability).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Foreign-key violation
  // -------------------------------------------------------------------------

  test('FK violation — skill_id 999999 not in skill_definitions', async () => {
    const id = await insertSubmission(supabase, makePayload({ skill_ids: [] }));

    const { error } = await supabase
      .from('caregiver_skills')
      .insert({ submission_id: id, skill_id: 999_999 });

    expect(error).not.toBeNull();
    // Postgres FK violation messages contain these keywords.
    expect(error!.message.toLowerCase()).toMatch(/foreign|violat|not present/i);
  });

  // -------------------------------------------------------------------------
  // Non-existent UUID operations (idempotency)
  // -------------------------------------------------------------------------

  test('UPDATE non-existent UUID — no error, 0 rows affected', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';

    const { data, error } = await supabase
      .from('submissions')
      .update({ status: 'processed' })
      .eq('id', fakeId)
      .select('id');

    // Supabase returns no error for an UPDATE that matches 0 rows.
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  test('DELETE non-existent UUID — idempotent, no error', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';

    // These must all be no-ops.
    await supabase.from('caregiver_skills').delete().eq('submission_id', fakeId);
    await supabase.from('ingestion_logs').delete().eq('submission_id', fakeId);
    const { error } = await supabase.from('submissions').delete().eq('id', fakeId);

    expect(error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Integer boundary values
  // -------------------------------------------------------------------------

  test('AGE boundary — age=0 and age=999 accepted (no DB check constraint)', async () => {
    const id0 = await insertSubmission(supabase, makePayload({ age: 0 }));
    const id999 = await insertSubmission(supabase, makePayload({ age: 999 }));

    const { data: rows, error } = await supabase
      .from('submissions')
      .select('id, age')
      .in('id', [id0, id999]);

    expect(error).toBeNull();
    const ages = (rows ?? [])
      .map((r: { age: number }) => r.age)
      .sort((a: number, b: number) => a - b);
    expect(ages).toContain(0);
    expect(ages).toContain(999);
  });

  test('YEARS_OF_EXPERIENCE boundary — 0 and 80 accepted', async () => {
    const id0 = await insertSubmission(supabase, makePayload({ years_of_experience: 0 }));
    const id80 = await insertSubmission(supabase, makePayload({ years_of_experience: 80 }));

    const { data: rows } = await supabase
      .from('submissions')
      .select('id, years_of_experience')
      .in('id', [id0, id80]);

    const years = (rows ?? [])
      .map((r: { years_of_experience: number }) => r.years_of_experience)
      .sort((a: number, b: number) => a - b);
    expect(years).toContain(0);
    expect(years).toContain(80);
  });

  // -------------------------------------------------------------------------
  // All valid enum combinations
  // -------------------------------------------------------------------------

  test('ALL enum permutations — every valid combination inserts cleanly', async () => {
    const statuses = ['received', 'processed', 'failed'] as const;
    const payPeriods = ['hour', 'day', 'month'] as const;
    const availabilities = ['Immediately / ASAP', '1-3 days notice', '1 week notice', '2 weeks notice'];

    const insertErrors: string[] = [];

    for (const status of statuses) {
      for (const pay_period of payPeriods) {
        for (const availability of availabilities) {
          try {
            await insertSubmission(
              supabase,
              makePayload({ status, pay_period, availability })
            );
          } catch (err) {
            insertErrors.push(
              `${status}/${pay_period}/${availability}: ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      }
    }

    // All 27 combinations must succeed.
    expect(insertErrors).toHaveLength(0);
  });
});
