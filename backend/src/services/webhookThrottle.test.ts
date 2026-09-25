import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../cache/redis.js", () => ({
  incrementCounter: vi.fn(),
}));

vi.mock("../logger.js", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { incrementCounter } from "../cache/redis.js";
import { logger } from "../logger.js";
import { isWebhookThrottled, currentHourBucket, throttleKey } from "./webhookThrottle.js";

const mockIncr = incrementCounter as ReturnType<typeof vi.fn>;

describe("currentHourBucket", () => {
  it("truncates a timestamp to the UTC hour", () => {
    expect(currentHourBucket(new Date("2026-08-28T14:37:09.123Z"))).toBe("2026-08-28T14");
  });

  it("rolls over at the top of the next hour", () => {
    const before = currentHourBucket(new Date("2026-08-28T14:59:59Z"));
    const after = currentHourBucket(new Date("2026-08-28T15:00:00Z"));
    expect(before).not.toBe(after);
  });
});

describe("throttleKey", () => {
  it("namespaces by webhook id and hour bucket", () => {
    expect(throttleKey(42, new Date("2026-08-28T14:00:00Z"))).toBe(
      "webhook:throttle:42:2026-08-28T14",
    );
  });
});

describe("isWebhookThrottled", () => {
  beforeEach(() => vi.clearAllMocks());

  it("never throttles when no limit is configured", async () => {
    expect(await isWebhookThrottled(1, null)).toBe(false);
    expect(await isWebhookThrottled(1, undefined)).toBe(false);
    expect(await isWebhookThrottled(1, 0)).toBe(false);
    expect(mockIncr).not.toHaveBeenCalled();
  });

  it("allows deliveries up to and including the limit", async () => {
    mockIncr.mockResolvedValueOnce(1);
    expect(await isWebhookThrottled(1, 3)).toBe(false);
    mockIncr.mockResolvedValueOnce(3);
    expect(await isWebhookThrottled(1, 3)).toBe(false);
  });

  it("throttles once the count exceeds the limit and logs a warning", async () => {
    mockIncr.mockResolvedValueOnce(4);
    expect(await isWebhookThrottled(7, 3)).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ webhookId: 7, maxPerHour: 3, count: 4 }),
      expect.stringContaining("throttle"),
    );
  });

  it("fails open when Redis is unavailable", async () => {
    mockIncr.mockResolvedValueOnce(null);
    expect(await isWebhookThrottled(1, 1)).toBe(false);
  });
});
