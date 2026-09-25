-- Issue #975: make vault descriptions searchable.
-- Adds a `description` column and extends the full-text search vector created
-- by Issue #191 to include it alongside name and symbol.
--
-- search_vector is a GENERATED ALWAYS AS column, so it is recomputed
-- automatically whenever name, symbol, or description changes — no trigger is
-- required. We drop and recreate the column so the expression stays in sync
-- with the latest schema.
ALTER TABLE vaults ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE vaults DROP COLUMN IF EXISTS search_vector;

ALTER TABLE vaults ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector(
      'english',
      COALESCE(name, '') || ' ' ||
      COALESCE(symbol, '') || ' ' ||
      COALESCE(description, '')
    )
  ) STORED;

CREATE INDEX IF NOT EXISTS idx_vaults_search_vector ON vaults USING GIN (search_vector);
