import { incrementCounter } from "../cache/redis.js";
import { logger } from "../logger.js";

/**
 * Redis key TTL for an hourly counter. Two hours is comfortably longer than a
 * single bucket's lifetime, so a key always expires on its own after the hour it
 * covers has passed — no explicit reset is needed.
 */
const THROTTLE_TTL_SECONDS = 2 * 60 * 60;

/**
 * The UTC clock hour a timestamp falls in, e.g. `"2026-08-28T14"`. Counters are
 * keyed by this string, so the count naturally resets when the hour rolls over.
 */
export function currentHourBucket(now: Date = new Date()): string {
  return now.toISOString().slice(0, 13);
}

export function throttleKey(webhookId: number, now?: Date): string {
  return `webhook:throttle:${webhookId}:${currentHourBucket(now)}`;
}

/**
 * Record a delivery attempt for a webhook in the current hour and report whether
 * it exceeds the webhook's configured per-hour cap (#1022).
 *
 * Returns `true` when the caller should skip this delivery. Fails open: with no
 * limit configured, or when Redis is unavailable, deliveries are always allowed
 * so a cache outage never silently drops events.
 */
export async function isWebhookThrottled(
  webhookId: number,
  maxPerHour: number | null | undefined,
): Promise<boolean> {
  if (maxPerHour == null || maxPerHour <= 0) return false;

  const count = await incrementCounter(throttleKey(webhookId), THROTTLE_TTL_SECONDS);
  if (count == null) return false;

  if (count > maxPerHour) {
    logger.warn(
      { webhookId, maxPerHour, count },
      "Webhook delivery skipped: per-hour throttle limit reached",
    );
    return true;
  }
  return false;
}
