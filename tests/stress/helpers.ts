/**
 * Shared helpers for all stress-test suites.
 *
 * Responsibilities:
 *  - Supabase admin client factory (reads .env.local via dotenv)
 *  - Typed test-data generators
 *  - insertSubmission() — mirrors createSubmission action, no redirect
 *  - cleanupTestData()  — deletes every row whose name starts with TEST_PREFIX
 *  - measureConcurrent() — runs N async tasks in parallel, collects latency stats
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomBytes } from 'crypto';

// Load .env.local once at module import time.
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Every test row's first_name is set to this prefix for easy bulk-cleanup. */
export const TEST_PREFIX = '__STRESS_TEST__';

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

export function getSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Missing Supabase env vars. ' +
        'Copy .env.local.example to .env.local and fill in NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.'
    );
  }

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ---------------------------------------------------------------------------
// Types (mirror lib/types.ts but standalone — no Next.js imports needed)
// ---------------------------------------------------------------------------

export interface WorkHistoryEntry {
  employer?: string;
  role?: string;
  duration?: string;
  description?: string;
  [key: string]: unknown;
}

export interface SubmissionPayload {
  first_name: string;
  last_name: string;
  birthdate: string;
  gender: string;
  location: string;
  contact_number: string;
  fb_link: string;
  years_of_experience: number;
  work_history: WorkHistoryEntry[];
  has_valid_id: boolean;
  valid_id_image_url: string | null;
  has_nbi_clearance: boolean;
  nbi_clearance_image_url: string | null;
  has_barangay_clearance: boolean;
  barangay_clearance_image_url: string | null;
  has_tesda_nc2: boolean;
  tesda_nc2_image_url: string | null;
  submitted_at: string | null;
  status: 'received' | 'processed' | 'failed';
  error_message: string | null;
  pay_rate: number | null;
  pay_period: 'hour' | 'day' | 'month' | null;
  availability: 'immediate' | 'this_week' | 'flexible' | null;
  avatar_url: string | null;
  /** Not a DB column — consumed by insertSubmission() and stripped before insert. */
  skill_ids: number[];
}

// ---------------------------------------------------------------------------
// Data generators
// ---------------------------------------------------------------------------

/**
 * Returns a fully populated SubmissionPayload with a unique name.
 * Pass `overrides` to customise any field.
 */
export function makePayload(overrides: Partial<SubmissionPayload> = {}): SubmissionPayload {
  // Combine timestamp + random suffix so rapid calls in a loop stay unique.
  const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  return {
    first_name: TEST_PREFIX,
    last_name: `User ${suffix}`,
    birthdate: '1998-04-21',
    gender: 'Female',
    location: 'Manila, Philippines',
    contact_number: '+63 912 345 6789',
    fb_link: 'https://facebook.com/test.stress.user',
    years_of_experience: 3,
    work_history: [
      {
        employer: 'Test Hospital',
        role: 'Caregiver',
        duration: '2 years',
        description: 'Providing home care services.',
      },
    ],
    has_valid_id: true,
    valid_id_image_url: null,
    has_nbi_clearance: false,
    nbi_clearance_image_url: null,
    has_barangay_clearance: false,
    barangay_clearance_image_url: null,
    has_tesda_nc2: false,
    tesda_nc2_image_url: null,
    submitted_at: null,
    status: 'received',
    error_message: null,
    pay_rate: 600,
    pay_period: 'day',
    availability: 'immediate',
    avatar_url: null,
    skill_ids: [],
    ...overrides,
  };
}

/** Returns `count` unique payloads. */
export function makeBulkPayloads(count: number): SubmissionPayload[] {
  return Array.from({ length: count }, (_, i) =>
    makePayload({ last_name: `Bulk-${i}-${Date.now()}-${randomBytes(2).toString('hex')}` })
  );
}

/**
 * Builds an oversized work_history array with `entryCount` entries.
 * Useful for testing JSONB storage limits.
 */
export function makeOversizedWorkHistory(entryCount = 50): WorkHistoryEntry[] {
  return Array.from({ length: entryCount }, (_, i) => ({
    employer: `Hospital ${i} — ${'x'.repeat(200)}`,
    role: 'Senior Caregiver',
    duration: `${i + 1} year${i !== 0 ? 's' : ''}`,
    description: 'y'.repeat(500),
  }));
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

/**
 * Inserts a full submission row + caregiver_skills rows.
 * Mirrors the logic of createSubmission() but without redirect() or 'use server'.
 * Returns the new submission UUID.
 */
export async function insertSubmission(
  supabase: SupabaseClient,
  payload: SubmissionPayload
): Promise<string> {
  const { skill_ids, ...submissionData } = payload;
  const idempotency_key = randomBytes(32).toString('hex');

  const { data, error } = await supabase
    .from('submissions')
    .insert({ ...submissionData, idempotency_key })
    .select('id')
    .single();

  if (error) {
    throw new Error(`insertSubmission failed: ${error.message} (code: ${error.code})`);
  }

  const id = data.id as string;

  if (skill_ids.length > 0) {
    const { error: skillError } = await supabase
      .from('caregiver_skills')
      .insert(skill_ids.map((skill_id) => ({ submission_id: id, skill_id })));

    if (skillError) {
      throw new Error(`insertSkills failed: ${skillError.message}`);
    }
  }

  return id;
}

/**
 * Deletes all stress-test rows (and their dependents) whose name starts with TEST_PREFIX.
 * Called in afterAll hooks of every spec file.
 */
export async function cleanupTestData(supabase: SupabaseClient): Promise<void> {
  const { data: rows } = await supabase
    .from('submissions')
    .select('id')
    .ilike('first_name', `${TEST_PREFIX}%`);

  if (!rows || rows.length === 0) return;

  const ids = rows.map((r: { id: string }) => r.id);

  // Delete dependents before the parent (no CASCADE in schema).
  await supabase.from('caregiver_skills').delete().in('submission_id', ids);
  await supabase.from('ingestion_logs').delete().in('submission_id', ids);
  await supabase.from('submissions').delete().in('id', ids);
}

// ---------------------------------------------------------------------------
// Latency / concurrency measurement
// ---------------------------------------------------------------------------

export interface LatencyStats {
  scenario: string;
  total: number;
  passed: number;
  failed: number;
  errors: string[];
  latency: {
    min: number;
    avg: number;
    p95: number;
    max: number;
  };
}

/**
 * Runs all tasks concurrently via Promise.allSettled, records per-task
 * wall-clock latency, and returns aggregated stats.
 */
export async function measureConcurrent<T>(
  scenario: string,
  tasks: Array<() => Promise<T>>
): Promise<LatencyStats> {
  const timings: number[] = [];
  const errors: string[] = [];

  const settled = await Promise.allSettled(
    tasks.map(async (task) => {
      const start = performance.now();
      try {
        const result = await task();
        timings.push(performance.now() - start);
        return result;
      } catch (err) {
        timings.push(performance.now() - start);
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(msg);
        throw err;
      }
    })
  );

  const passed = settled.filter((r) => r.status === 'fulfilled').length;
  const failed = settled.filter((r) => r.status === 'rejected').length;

  timings.sort((a, b) => a - b);
  const avg = timings.length > 0 ? timings.reduce((s, t) => s + t, 0) / timings.length : 0;
  const p95Index = Math.min(Math.floor(timings.length * 0.95), timings.length - 1);
  const p95 = timings[p95Index] ?? 0;

  const stats: LatencyStats = {
    scenario,
    total: tasks.length,
    passed,
    failed,
    errors,
    latency: {
      min: Math.round(timings[0] ?? 0),
      avg: Math.round(avg),
      p95: Math.round(p95),
      max: Math.round(timings[timings.length - 1] ?? 0),
    },
  };

  console.log(`\n  [STRESS] ${scenario}`);
  console.log(
    `    result : ${stats.passed}/${stats.total} passed, ${stats.failed} failed`
  );
  console.log(
    `    latency: min=${stats.latency.min}ms  avg=${stats.latency.avg}ms  p95=${stats.latency.p95}ms  max=${stats.latency.max}ms`
  );
  if (errors.length > 0) {
    console.log(`    errors : ${errors.slice(0, 3).join(' | ')}`);
  }

  return stats;
}
