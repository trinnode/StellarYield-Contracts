-- Issue #977: Add document accessibility tracking
ALTER TABLE vaults
  ADD COLUMN IF NOT EXISTS document_accessible BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS document_last_checked TIMESTAMPTZ DEFAULT NULL;
