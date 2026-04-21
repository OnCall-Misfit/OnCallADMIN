/**
 * Phase 4 — Full-Stack Server Actions via Playwright Browser
 *
 * These tests exercise the real Next.js code path:
 *   Browser → SubmissionForm → createSubmission / updateSubmission / deleteSubmission
 *   → Supabase → revalidatePath / redirect → back to browser
 *
 * Run config: playwright.e2e.config.ts  (starts next dev automatically)
 *
 * Tests:
 *   1. CREATE via UI form   — fill + submit → verify row in DB
 *   2. READ / display       — navigate to edit page → verify fields pre-filled
 *   3. UPDATE via UI form   — edit fields + save → verify changes in DB
 *   4. DELETE via UI button — confirm dialog → row gone from table + DB
 *   5. CONCURRENT submits   — 3 browser contexts simultaneously → all land in DB
 *   6. CLIENT ERROR display — invalid work_history JSON → error banner shown
 */

import { test, expect, Browser, Page } from '@playwright/test';
import {
  getSupabaseClient,
  makePayload,
  insertSubmission,
  cleanupTestData,
  TEST_PREFIX,
} from '../stress/helpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const supabase = getSupabaseClient();

/**
 * Fills the mandatory form fields.  All other fields keep their defaults,
 * which are valid (work_history defaults to '[]', status to 'received').
 */
async function fillMinimalForm(page: Page, firstName: string, lastName: string): Promise<void> {
  // Clear and fill each required field.
  await page.fill('input[name="first_name"]', firstName);
  await page.fill('input[name="last_name"]', lastName);
  await page.fill('input[name="age"]', '28');
  await page.fill('input[name="location"]', 'Manila, Philippines');
  await page.fill('input[name="contact_number"]', '+63 912 345 6789');
  await page.fill('input[name="fb_link"]', 'https://facebook.com/e2e.test.user');
}

/** Submits the form and waits for the redirect back to /. */
async function submitAndWait(page: Page): Promise<void> {
  await Promise.all([
    page.waitForURL('/'),
    page.click('button[type="submit"]'),
  ]);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

test.describe('Phase 4 — Full-Stack Server Actions (E2E)', () => {
  test.afterAll(async () => {
    await cleanupTestData(supabase);
  });

  // -------------------------------------------------------------------------
  // 1. CREATE via UI
  // -------------------------------------------------------------------------

  test('CREATE via form — submission lands in DB and appears in list', async ({ page }) => {
    const lastName = `E2E-Create-${Date.now()}`;

    await page.goto('/submissions/new');
    await fillMinimalForm(page, TEST_PREFIX, lastName);
    await submitAndWait(page);

    // After redirect we should be on the home page.
    expect(page.url()).toMatch(/localhost:3000\/?$/);

    // Verify the row exists in Supabase.
    const { data: rows } = await supabase
      .from('submissions')
      .select('id, first_name, last_name, status')
      .eq('first_name', TEST_PREFIX)
      .eq('last_name', lastName);

    expect((rows ?? []).length).toBe(1);
    expect(rows![0].status).toBe('received');

    // The submission must also appear in the on-screen table.
    await expect(page.locator(`text=${TEST_PREFIX} ${lastName}`)).toBeVisible();
  });

  // -------------------------------------------------------------------------
  // 2. READ / display on the edit page
  // -------------------------------------------------------------------------

  test('READ — edit page pre-fills all saved field values', async ({ page }) => {
    // Insert directly so we control exact values.
    const lastName = `E2E-Read-${Date.now()}`;
    const id = await insertSubmission(
      supabase,
      makePayload({
        last_name: lastName,
        age: 35,
        location: 'Cebu City',
        contact_number: '+63 999 888 7777',
        status: 'processed',
        pay_rate: 850,
        pay_period: 'day',
      })
    );

    await page.goto(`/submissions/${id}`);

    // Heading shows the submission name.
    await expect(page.locator('h1')).toContainText(`${TEST_PREFIX} ${lastName}`);

    // Fields must reflect the DB values.
    await expect(page.locator('input[name="first_name"]')).toHaveValue(TEST_PREFIX);
    await expect(page.locator('input[name="last_name"]')).toHaveValue(lastName);
    await expect(page.locator('input[name="age"]')).toHaveValue('35');
    await expect(page.locator('input[name="location"]')).toHaveValue('Cebu City');
    await expect(page.locator('input[name="contact_number"]')).toHaveValue('+63 999 888 7777');
    await expect(page.locator('select[name="status"]')).toHaveValue('processed');
    await expect(page.locator('input[name="pay_rate"]')).toHaveValue('850');
    await expect(page.locator('select[name="pay_period"]')).toHaveValue('day');
  });

  // -------------------------------------------------------------------------
  // 3. UPDATE via UI
  // -------------------------------------------------------------------------

  test('UPDATE via form — changed fields persist in DB', async ({ page }) => {
    const origLastName = `E2E-Update-orig-${Date.now()}`;
    const id = await insertSubmission(
      supabase,
      makePayload({ last_name: origLastName, status: 'received', pay_rate: 500 })
    );

    await page.goto(`/submissions/${id}`);

    // Change last_name, status, and pay_rate.
    const newLastName = `E2E-Update-new-${Date.now()}`;
    await page.fill('input[name="first_name"]', TEST_PREFIX);
    await page.fill('input[name="last_name"]', newLastName);
    await page.selectOption('select[name="status"]', 'processed');
    await page.fill('input[name="pay_rate"]', '900');

    // Submit expects "Update Submission" text on the button.
    await expect(page.locator('button[type="submit"]')).toContainText('Update Submission');
    await submitAndWait(page);

    // Verify DB reflects the changes.
    const { data: row } = await supabase
      .from('submissions')
      .select('first_name, last_name, status, pay_rate')
      .eq('id', id)
      .single();

    expect(row!.first_name).toBe(TEST_PREFIX);
    expect(row!.last_name).toBe(newLastName);
    expect(row!.status).toBe('processed');
    expect(row!.pay_rate).toBe(900);
  });

  // -------------------------------------------------------------------------
  // 4. DELETE via UI
  // -------------------------------------------------------------------------

  test('DELETE via table button — row removed from UI and DB', async ({ page }) => {
    const lastName = `E2E-Delete-${Date.now()}`;
    const displayName = `${TEST_PREFIX} ${lastName}`;
    const id = await insertSubmission(supabase, makePayload({ last_name: lastName }));

    await page.goto('/');

    // The row must be visible before deleting.
    await expect(page.locator(`text=${displayName}`)).toBeVisible();

    // Accept the confirm() dialog before clicking delete.
    page.once('dialog', (dialog) => dialog.accept());

    // Click the Delete button for this specific row.
    const row = page.locator('tr', { hasText: displayName });
    await row.locator('button', { hasText: 'Delete' }).click();

    // Wait for the table to re-render (router.refresh() triggers a re-fetch).
    await page.waitForResponse((resp) => resp.url().includes('localhost') && resp.status() === 200);

    // Row must no longer be in the DOM.
    await expect(page.locator(`text=${displayName}`)).not.toBeVisible({ timeout: 8_000 });

    // Row must be gone from Supabase too.
    const { data: gone } = await supabase
      .from('submissions')
      .select('id')
      .eq('id', id)
      .maybeSingle();
    expect(gone).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 5. Concurrent submits — 3 browser contexts simultaneously
  // -------------------------------------------------------------------------

  test('CONCURRENT CREATES — 3 browser contexts submit at the same time', async ({
    browser,
  }: {
    browser: Browser;
  }) => {
    const lastNames = Array.from(
      { length: 3 },
      (_, i) => `E2E-Concurrent-${i}-${Date.now()}`
    );

    // Spin up 3 independent browser contexts (simulate 3 different users).
    const contexts = await Promise.all(
      lastNames.map(() => browser.newContext({ baseURL: 'http://localhost:3000' }))
    );
    const pages = await Promise.all(contexts.map((ctx) => ctx.newPage()));

    // Navigate all 3 to the new-submission page in parallel.
    await Promise.all(pages.map((p) => p.goto('/submissions/new')));

    // Fill all 3 forms in parallel.
    await Promise.all(pages.map((p, i) => fillMinimalForm(p, TEST_PREFIX, lastNames[i])));

    // Submit all 3 simultaneously and wait for each redirect.
    await Promise.all(
      pages.map((p) =>
        Promise.all([p.waitForURL('/'), p.click('button[type="submit"]')])
      )
    );

    // Tear down contexts.
    await Promise.all(contexts.map((ctx) => ctx.close()));

    // All 3 submissions must be in the DB.
    const { data: rows } = await supabase
      .from('submissions')
      .select('first_name, last_name')
      .eq('first_name', TEST_PREFIX)
      .in('last_name', lastNames);

    expect((rows ?? []).length).toBe(3);
  });

  // -------------------------------------------------------------------------
  // 6. Client-side error display — invalid work_history JSON
  // -------------------------------------------------------------------------

  test('CLIENT ERROR — invalid work_history JSON shows error banner', async ({ page }) => {
    await page.goto('/submissions/new');
    await fillMinimalForm(page, TEST_PREFIX, `E2E-Error-${Date.now()}`);

    // Overwrite work_history with invalid JSON to trigger the client-side guard.
    await page.fill('textarea[name="work_history"]', '{ not valid json ]]]');

    await page.click('button[type="submit"]');

    // The red error banner must appear — form should NOT navigate away.
    const errorBanner = page.locator('.bg-red-50');
    await expect(errorBanner).toBeVisible({ timeout: 5_000 });
    await expect(errorBanner).toContainText('work_history');

    // URL must still be /submissions/new — no redirect occurred.
    expect(page.url()).toContain('/submissions/new');
  });

  // -------------------------------------------------------------------------
  // 7. NAVIGATE — cancel button returns to previous page
  // -------------------------------------------------------------------------

  test('CANCEL button — navigates back without creating a submission', async ({ page }) => {
    await page.goto('/');

    // Count submissions before.
    const { count: before } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .ilike('first_name', `${TEST_PREFIX}%`);

    await page.goto('/submissions/new');
    await fillMinimalForm(page, TEST_PREFIX, `E2E-Cancel-${Date.now()}`);

    // Click Cancel instead of submitting.
    await page.click('button[type="button"]'); // "Cancel" button

    // Count must be unchanged.
    const { count: after } = await supabase
      .from('submissions')
      .select('id', { count: 'exact', head: true })
      .ilike('first_name', `${TEST_PREFIX}%`);

    expect(after).toBe(before);
  });
});
