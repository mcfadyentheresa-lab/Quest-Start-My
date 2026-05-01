import type { ReflectionDraft } from "./types";

export const REFLECTION_DRAFT_CACHE_TTL_MS = 60 * 60 * 1000;

type CacheKey = string;

const cache = new Map<CacheKey, ReflectionDraft>();

export function makeCacheKey(
  userId: string | null,
  cadence: "week" | "month",
  periodStart: string,
): CacheKey {
  return `${userId ?? "anon"}|${cadence}|${periodStart}`;
}

export function getCachedDraft(key: CacheKey, now: Date = new Date()): ReflectionDraft | null {
  const cached = cache.get(key);
  if (!cached) return null;
  const generated = new Date(cached.generatedAt);
  if (now.getTime() - generated.getTime() >= REFLECTION_DRAFT_CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return cached;
}

export function setCachedDraft(key: CacheKey, draft: ReflectionDraft): void {
  cache.set(key, draft);
}

export function clearReflectionDraftCache(): void {
  cache.clear();
}
