import type { BriefingResponse } from "./types";

export const CACHE_TTL_MS = 60 * 60 * 1000;

export function isCacheFresh(generatedAt: Date | string, now: Date = new Date()): boolean {
  const generated = typeof generatedAt === "string" ? new Date(generatedAt) : generatedAt;
  return now.getTime() - generated.getTime() < CACHE_TTL_MS;
}

export function shouldServeFromCache(
  cached: BriefingResponse | null,
  options: { hint?: string; bypassCache?: boolean; now?: Date } = {},
): boolean {
  if (options.bypassCache) return false;
  if (options.hint) return false;
  if (!cached) return false;
  return isCacheFresh(cached.generatedAt, options.now ?? new Date());
}
