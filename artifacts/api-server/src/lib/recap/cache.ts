import type { RecapResponse } from "./types";

export const CACHE_TTL_MS = 60 * 60 * 1000;

export function isCacheFresh(generatedAt: Date | string, now: Date = new Date()): boolean {
  const generated = typeof generatedAt === "string" ? new Date(generatedAt) : generatedAt;
  return now.getTime() - generated.getTime() < CACHE_TTL_MS;
}

export function shouldServeFromCache(
  cached: RecapResponse | null,
  options: {
    bypassCache?: boolean;
    now?: Date;
    /**
     * Current count of completed tasks for this user/date. If different from
     * what the cached recap saw, the cache is stale — the user closed (or
     * un-closed) something after the recap was built.
     */
    currentDoneCount?: number;
  } = {},
): boolean {
  if (options.bypassCache) return false;
  if (!cached) return false;
  if (!isCacheFresh(cached.generatedAt, options.now ?? new Date())) return false;
  if (
    typeof options.currentDoneCount === "number" &&
    options.currentDoneCount !== cached.closedToday.length
  ) {
    return false;
  }
  return true;
}
