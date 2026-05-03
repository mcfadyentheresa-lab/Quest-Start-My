/**
 * Single source of truth for reading the OpenAI API key.
 *
 * Background: Quest used to read `OPENAI_API_KEY`. The Aster sibling app
 * uses `AI_INTEGRATIONS_OPENAI_API_KEY`. We standardise on the longer,
 * namespaced name across both apps so a single Railway shared variable
 * reaches everywhere. The old name is still honoured as a fallback so
 * nothing breaks if a deploy still has the old variable set.
 *
 * Returns null when no usable key is present, so callers can branch on
 * `if (!key) return rulesFallback()` without doing string-emptiness
 * checks themselves.
 */
export function readOpenAiApiKey(): string | null {
  const candidates = [
    process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
    process.env["OPENAI_API_KEY"],
  ];
  for (const raw of candidates) {
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}
