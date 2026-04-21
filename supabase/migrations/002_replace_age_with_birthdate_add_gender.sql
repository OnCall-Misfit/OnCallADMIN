-- Migration 002: Replace age (integer) with birthdate (date) and add gender column
-- Run against: submissions table

-- ── Step 1: Add birthdate column (nullable initially to allow backfill) ──────
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS birthdate DATE DEFAULT NULL;

-- ── Step 2: Backfill birthdate from existing age values ────────────────────
-- We approximate by subtracting the stored age in years from today.
-- Rows where age IS NULL fall back to a sentinel date (1970-01-01).
UPDATE submissions
SET birthdate = CASE
  WHEN age IS NOT NULL THEN (CURRENT_DATE - (age || ' years')::INTERVAL)::DATE
  ELSE '1970-01-01'::DATE
END
WHERE birthdate IS NULL;

-- ── Step 3: Lock down birthdate as NOT NULL ────────────────────────────────
ALTER TABLE submissions
  ALTER COLUMN birthdate SET NOT NULL;

-- ── Step 4: Remove the old age column ──────────────────────────────────────
ALTER TABLE submissions
  DROP COLUMN IF EXISTS age;

-- ── Step 5: Add gender column ──────────────────────────────────────────────
-- NOT NULL with CHECK constraint enforcing the four allowed options.
-- Existing rows receive 'Prefer not to say' as a safe default.
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL
    DEFAULT 'Prefer not to say'
    CHECK (gender IN ('Male', 'Female', 'LGBTQ+', 'Prefer not to say'));
