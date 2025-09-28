import { LRUCache } from "lru-cache";
import { rateLimitMax, rateLimitWindowMs } from "@/lib/env";

const limiter = new LRUCache<string, { hits: number; reset: number }>({
  max: 5000,
});

export function assertRateLimit(identifier: string) {
  const now = Date.now();
  const current = limiter.get(identifier);
  if (!current || current.reset < now) {
    limiter.set(identifier, { hits: 1, reset: now + rateLimitWindowMs });
    return;
  }

  if (current.hits + 1 > rateLimitMax) {
    throw Object.assign(new Error("Rate limit exceeded"), {
      status: 429,
      reset: current.reset,
    });
  }

  current.hits += 1;
  limiter.set(identifier, current, { ttl: current.reset - now });
}
