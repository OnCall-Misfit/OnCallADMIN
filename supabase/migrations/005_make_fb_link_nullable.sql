-- Migration 005: Allow Facebook links to be nullable
-- Existing blank values are normalized to NULL so the column has one
-- representation for "not provided".

UPDATE submissions
SET fb_link = NULL
WHERE fb_link IS NOT NULL
  AND btrim(fb_link) = '';

ALTER TABLE submissions
  ALTER COLUMN fb_link DROP NOT NULL;