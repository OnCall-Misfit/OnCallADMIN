/**
 * Playwright config for STRESS TESTS (direct Supabase, no browser required).
 *
 * Run:  npm run test:stress
 *
 * Workers are kept at 1 so that spec files run sequentially — this prevents
 * concurrent afterAll cleanups from colliding and deleting each other's data.
 */
import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env.local') });

export default defineConfig({
  testDir: './tests/stress',
  timeout: 60_000,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report/stress', open: 'never' }],
  ],
});
