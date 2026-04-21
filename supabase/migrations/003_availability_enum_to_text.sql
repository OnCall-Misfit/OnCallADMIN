-- Migration: Change availability from enum to plain TEXT
-- Previously: availability TEXT CHECK (availability IN ('immediate', 'this_week', 'flexible'))
-- Now: free-form text field (validated at the application layer)

-- Drop any existing CHECK constraint on availability
ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_availability_check;

-- Change column type to TEXT (no enum restriction)
ALTER TABLE submissions
  ALTER COLUMN availability TYPE TEXT;
