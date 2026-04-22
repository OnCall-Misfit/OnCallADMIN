-- Migration 004: Fix availability column — convert from PostgreSQL enum type to TEXT
--
-- Migration 003 attempted this via DROP CONSTRAINT + ALTER COLUMN TYPE TEXT,
-- but the column was typed as a custom PostgreSQL enum (availability_status),
-- not a TEXT column with a CHECK constraint.  Converting from an enum type
-- requires the explicit USING clause; without it the ALTER silently fails or
-- is rejected, leaving the column still typed as the enum.
--
-- This migration properly finishes the job.

-- ── Step 1: Convert enum column to plain TEXT ─────────────────────────────
-- USING casts each existing enum value to its text label.
ALTER TABLE submissions
  ALTER COLUMN availability TYPE TEXT USING availability::TEXT;

-- ── Step 2: Drop the now-unused enum type ────────────────────────────────
-- IF EXISTS makes this safe to run even if Step 1 in migration 003 already
-- dropped it (idempotent).
DROP TYPE IF EXISTS availability_status;
