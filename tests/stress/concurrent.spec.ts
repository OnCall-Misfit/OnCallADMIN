/**
 * Phase 2 — Concurrent Load Tests
 *
 * Each test fires CONCURRENCY tasks simultaneously via Promise.allSettled and
 * records per-task wall-clock latency.  Results are aggregated into a summary
 * table that is printed to stdout after all tests complete.
 *
 * Cap: CONCURRENCY = 10  (safe for Supabase free tier / pgBouncer limits)
 *
 * Scenarios:
 *   1. 10× concurrent reads
 *   2. 10× concurrent creates
 *   3. 10× concurrent updates (each on a different row)
 *   4. 10× concurrent deletes (each on a different row)
 *   5. Read-under-write (5 reads + 5 writes interleaved)
 *   6. Mixed chaos (reads / creates / updates in random order)
 */

import { test, expect } from '@playwright/test';
import {
  getSupabaseClient,
  makePayload,
  insertSubmission,
  cleanupTestData,
  measureConcurrent,
  LatencyStats,
} from './helpers';

const CONCURRENCY = 10;
const supabase = getSupabaseClient();

test.describe('Phase 2 — Concurrent Load', () => {
  const allStats: LatencyStats[] = [];

  test.afterAll(async () => {
    await cleanupTestData(supabase);

    // Print a tidy summary table for quick assessment.
    console.log('\n  ╔══════════════════════════════════════════════════════════╗');
    console.log('  ║             CONCURRENT STRESS TEST SUMMARY              ║');
    console.log('  ╠══════════════════════════════════════════════════════════╣');
    for (const s of allStats) {
      const label = s.scenario.padEnd(36).slice(0, 36);
      const result = `✓ ${s.passed}/${s.total}  ✗ ${s.failed}`.padEnd(14);
      const lat = `avg=${s.latency.avg}ms p95=${s.latency.p95}ms`;
      console.log(`  ║ ${label} ${result} ${lat.padEnd(22)} ║`);
    }
    console.log('  ╚══════════════════════════════════════════════════════════╝');
  });

  // -------------------------------------------------------------------------
  // 1. Concurrent reads
  // -------------------------------------------------------------------------

  test(`${CONCURRENCY}× concurrent SELECTs`, async () => {
    // Seed a handful of rows so reads return actual data.
    for (let i = 0; i < 5; i++) {
      await insertSubmission(
        supabase,
        makePayload({ last_name: `ReadSeed-${i}` })
      );
    }

    const tasks = Array.from({ length: CONCURRENCY }, () => async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, first_name, last_name, status, created_at')
        .ilike('first_name', '__STRESS_TEST__%')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw new Error(error.message);
      return data;
    });

    const stats = await measureConcurrent(`${CONCURRENCY}× concurrent reads`, tasks);
    allStats.push(stats);

    expect(stats.failed).toBe(0);
    // Free tier should handle 10 concurrent reads well under 10 s p95.
    expect(stats.latency.p95).toBeLessThan(10_000);
  });

  // -------------------------------------------------------------------------
  // 2. Concurrent creates
  // -------------------------------------------------------------------------

  test(`${CONCURRENCY}× concurrent INSERTs`, async () => {
    const tasks = Array.from({ length: CONCURRENCY }, (_, i) => async () => {
      return insertSubmission(
        supabase,
        makePayload({ last_name: `ConcCreate-${i}` })
      );
    });

    const stats = await measureConcurrent(`${CONCURRENCY}× concurrent creates`, tasks);
    allStats.push(stats);

    expect(stats.failed).toBe(0);

    // All rows must exist in the DB — no silent failures.
    const { data: rows } = await supabase
      .from('submissions')
      .select('id')
      .ilike('last_name', 'ConcCreate-%');
    expect((rows ?? []).length).toBeGreaterThanOrEqual(CONCURRENCY);
  });

  // -------------------------------------------------------------------------
  // 3. Concurrent updates (each task targets a different row — no conflicts)
  // -------------------------------------------------------------------------

  test(`${CONCURRENCY}× concurrent UPDATEs on distinct rows`, async () => {
    // Pre-insert one row per concurrent task.
    const ids = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        insertSubmission(
          supabase,
          makePayload({ last_name: `UpdRow-${i}` })
        )
      )
    );

    const tasks = ids.map((id, i) => async () => {
      const { error } = await supabase
        .from('submissions')
        .update({
          status: 'processed',
          pay_rate: 100 + i,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw new Error(error.message);
    });

    const stats = await measureConcurrent(`${CONCURRENCY}× concurrent updates`, tasks);
    allStats.push(stats);

    expect(stats.failed).toBe(0);

    // Every row must now reflect the updated status.
    const { data: rows } = await supabase
      .from('submissions')
      .select('id, status, pay_rate')
      .in('id', ids);

    const processed = (rows ?? []).filter(
      (r: { status: string }) => r.status === 'processed'
    );
    expect(processed.length).toBe(CONCURRENCY);

    // Each pay_rate must be unique (no lost-update / clobber).
    const rates = (rows ?? []).map((r: { pay_rate: number }) => r.pay_rate).sort(
      (a: number, b: number) => a - b
    );
    const expected = Array.from({ length: CONCURRENCY }, (_, i) => 100 + i);
    expect(rates).toEqual(expected);
  });

  // -------------------------------------------------------------------------
  // 4. Concurrent deletes (each task targets a different row)
  // -------------------------------------------------------------------------

  test(`${CONCURRENCY}× concurrent DELETEs on distinct rows`, async () => {
    const ids = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        insertSubmission(
          supabase,
          makePayload({ last_name: `DelRow-${i}` })
        )
      )
    );

    const tasks = ids.map((id) => async () => {
      // Mirror deleteSubmission action: dependents first, then parent.
      await supabase.from('caregiver_skills').delete().eq('submission_id', id);
      await supabase.from('ingestion_logs').delete().eq('submission_id', id);
      const { error } = await supabase.from('submissions').delete().eq('id', id);
      if (error) throw new Error(error.message);
    });

    const stats = await measureConcurrent(`${CONCURRENCY}× concurrent deletes`, tasks);
    allStats.push(stats);

    expect(stats.failed).toBe(0);

    // All rows must be gone — no partial deletes.
    const { data: remaining } = await supabase
      .from('submissions')
      .select('id')
      .in('id', ids);
    expect(remaining ?? []).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // 5. Read-under-write — 5 reads + 5 writes interleaved
  // -------------------------------------------------------------------------

  test('5 reads + 5 writes — no isolation failures', async () => {
    // Seed some rows so reads always return data.
    for (let i = 0; i < 3; i++) {
      await insertSubmission(
        supabase,
        makePayload({ last_name: `RUW-baseline-${i}` })
      );
    }

    const readTasks = Array.from({ length: 5 }, () => async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, first_name, last_name, status')
        .ilike('first_name', '__STRESS_TEST__%')
        .limit(5);
      if (error) throw new Error(error.message);
      return data;
    });

    const writeTasks = Array.from({ length: 5 }, (_, i) => async () => {
      return insertSubmission(
        supabase,
        makePayload({ last_name: `RUW-write-${i}` })
      );
    });

    // Shuffle reads and writes together to maximise interleaving.
    const mixed = ([...readTasks, ...writeTasks] as Array<() => Promise<unknown>>).sort(
      () => Math.random() - 0.5
    );

    const stats = await measureConcurrent('5 reads + 5 writes interleaved', mixed);
    allStats.push(stats);

    expect(stats.failed).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 6. Mixed chaos — reads / creates / updates all at once
  // -------------------------------------------------------------------------

  test(`${CONCURRENCY}× mixed chaos (R/C/U in random order)`, async () => {
    // Pre-insert rows that update tasks can target.
    const preIds = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        insertSubmission(
          supabase,
          makePayload({ last_name: `Chaos-pre-${i}` })
        )
      )
    );
    let updateCursor = 0;

    const tasks = Array.from({ length: CONCURRENCY }, (_, i) => {
      const op = i % 4;

      if (op === 0) {
        // Read
        return async () => {
          const { error } = await supabase
            .from('submissions')
            .select('id, first_name, last_name, status')
            .ilike('first_name', '__STRESS_TEST__%')
            .limit(5);
          if (error) throw new Error(error.message);
        };
      }

      if (op === 1) {
        // Create
        return async () => {
          await insertSubmission(
            supabase,
            makePayload({ last_name: `Chaos-new-${i}` })
          );
        };
      }

      if (op === 2 && updateCursor < preIds.length) {
        // Update a pre-seeded row
        const id = preIds[updateCursor++];
        return async () => {
          const { error } = await supabase
            .from('submissions')
            .update({ status: 'processed', updated_at: new Date().toISOString() })
            .eq('id', id);
          if (error) throw new Error(error.message);
        };
      }

      // Fallback: read
      return async () => {
        const { error } = await supabase
          .from('submissions')
          .select('id')
          .ilike('first_name', '__STRESS_TEST__%')
          .limit(3);
        if (error) throw new Error(error.message);
      };
    });

    // Shuffle for maximum chaos.
    tasks.sort(() => Math.random() - 0.5);

    const stats = await measureConcurrent(`${CONCURRENCY}× mixed chaos`, tasks);
    allStats.push(stats);

    // Zero errors — the DB must handle the concurrent load cleanly.
    expect(stats.failed).toBe(0);
  });

  // -------------------------------------------------------------------------
  // 7. 10-Worker full lifecycle — create → edit → delete
  // -------------------------------------------------------------------------

  test('10 WORKER LIFECYCLE — each worker creates 1-10 profiles, edits all, then deletes all', async () => {
    const WORKERS = 10;

    interface WorkerResult {
      workerId: number;
      profileCount: number;
      created: number;
      edited: number;
      deleted: number;
      durationMs: number;
    }

    const workerStart = performance.now();

    // Each Array.from mapper is itself an async function — no IIFE needed.
    const settled = await Promise.allSettled(
      Array.from({ length: WORKERS }, async (_, workerId): Promise<WorkerResult> => {
        const start = performance.now();

        // Each worker independently decides how many profiles to create (1–10).
        const profileCount = Math.floor(Math.random() * 10) + 1;
        const ids: string[] = [];

        // ── PHASE A: Create ───────────────────────────────────────────────
        for (let i = 0; i < profileCount; i++) {
          const id = await insertSubmission(
            supabase,
            makePayload({
              last_name: `W${workerId}-P${i}-${Date.now()}`,
              // Vary the data per worker so updates are meaningful.
              status: 'received',
              pay_rate: 400 + workerId * 50,
              availability: (['Immediately / ASAP', '1 week notice', '2 weeks notice'])[workerId % 3],
              years_of_experience: workerId + i,
            })
          );
          ids.push(id);
        }

        // ── PHASE B: Edit all (status → processed, pay_rate bumped) ───────
        for (const id of ids) {
          const { error } = await supabase
            .from('submissions')
            .update({
              status: 'processed',
              pay_rate: 400 + workerId * 50 + 100,
              error_message: null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', id);
          if (error) throw new Error(`Worker ${workerId} update failed: ${error.message}`);
        }

        // Verify edits landed before deleting.
        const { data: edited } = await supabase
          .from('submissions')
          .select('id, status')
          .in('id', ids);
        const processedCount = (edited ?? []).filter(
          (r: { status: string }) => r.status === 'processed'
        ).length;
        if (processedCount !== ids.length) {
          throw new Error(
            `Worker ${workerId}: expected ${ids.length} processed rows, got ${processedCount}`
          );
        }

        // ── PHASE C: Delete all ───────────────────────────────────────────
        for (const id of ids) {
          await supabase.from('caregiver_skills').delete().eq('submission_id', id);
          await supabase.from('ingestion_logs').delete().eq('submission_id', id);
          const { error } = await supabase.from('submissions').delete().eq('id', id);
          if (error) throw new Error(`Worker ${workerId} delete failed: ${error.message}`);
        }

        // Verify all rows are gone.
        const { data: remaining } = await supabase
          .from('submissions')
          .select('id')
          .in('id', ids);
        if ((remaining ?? []).length !== 0) {
          throw new Error(
            `Worker ${workerId}: ${(remaining ?? []).length} rows not deleted`
          );
        }

        return {
          workerId,
          profileCount,
          created: ids.length,
          edited: ids.length,
          deleted: ids.length,
          durationMs: Math.round(performance.now() - start),
        };
      })
    );

    const totalMs = Math.round(performance.now() - workerStart);
    const passed = settled.filter(
      (r): r is PromiseFulfilledResult<WorkerResult> => r.status === 'fulfilled'
    );
    const failed = settled.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected'
    );

    // Print per-worker summary.
    console.log(`\n  [LIFECYCLE] 10-worker full lifecycle  (wall time: ${totalMs}ms)`);
    console.log('  ┌──────────┬──────────┬──────────┬──────────┬─────────────┐');
    console.log('  │ Worker   │ Created  │ Edited   │ Deleted  │ Duration    │');
    console.log('  ├──────────┼──────────┼──────────┼──────────┼─────────────┤');
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        const r = result.value;
        console.log(
          `  │ W${String(r.workerId).padEnd(8)}│ ${String(r.created).padEnd(9)}│ ${String(r.edited).padEnd(9)}│ ${String(r.deleted).padEnd(9)}│ ${String(r.durationMs + 'ms').padEnd(12)}│`
        );
      } else {
        console.log(`  │ FAILED   │ —        │ —        │ —        │ ${String(result.reason).slice(0, 12).padEnd(12)}│`);
      }
    }
    console.log('  └──────────┴──────────┴──────────┴──────────┴─────────────┘');
    console.log(`  Total profiles touched: ${passed.reduce((s, r) => s + r.value.created, 0)}`);

    const stats: LatencyStats = {
      scenario: '10-worker full lifecycle',
      total: WORKERS,
      passed: passed.length,
      failed: failed.length,
      errors: failed.map((r) => String(r.reason)),
      latency: { min: 0, avg: 0, p95: 0, max: 0 },
    };
    allStats.push(stats);

    // All 10 workers must complete without errors.
    expect(failed).toHaveLength(0);

    // Confirm zero leftover rows in the DB (all workers cleaned up after themselves).
    const { data: leftover } = await supabase
      .from('submissions')
      .select('id')
      .ilike('last_name', 'W%');
    expect(leftover ?? []).toHaveLength(0);
  });
});
