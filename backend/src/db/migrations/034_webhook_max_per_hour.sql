-- Issue #1022: Per-event notification throttling.
-- max_per_hour caps how many deliveries a single webhook may receive within a
-- clock hour. NULL means no limit. The running count is tracked per webhook per
-- hour in Redis; when it exceeds this value, deliveries are skipped until the
-- next hour.
ALTER TABLE webhooks ADD COLUMN IF NOT EXISTS max_per_hour INTEGER;
