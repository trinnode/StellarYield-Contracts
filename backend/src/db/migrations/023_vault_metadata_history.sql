-- Issue #972: track a chronological log of changes to vault metadata fields.
-- Issues #391–#394 write to this table; #973 exposes it via an API endpoint.
CREATE TABLE IF NOT EXISTS vault_metadata_history (
  id           SERIAL PRIMARY KEY,
  vault_id     INT NOT NULL REFERENCES vaults(id),
  field        TEXT NOT NULL,
  old_value    TEXT,
  new_value    TEXT,
  changed_by   TEXT,
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Primary access pattern: history for a single vault, optionally filtered by
-- the changed field (#972).
CREATE INDEX IF NOT EXISTS idx_vault_metadata_history_vault_field
  ON vault_metadata_history (vault_id, field);
