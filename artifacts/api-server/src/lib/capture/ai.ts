// Universal Capture — AI brain-dump cleaner.
//
// The user pastes a stream of consciousness. Our job is to turn it into
// a tidy task without losing anything. Output:
//
//   {
//     title:           string,       // 3–7 words, imperative, concrete
//     whyItMatters:    string|null,  // one short sentence, optional
//     doneLooksLike:   string|null,  // one short sentence, optional
//   }
//
// Mirrors the pattern in breakdown/ai.ts: a swappable chatClient (so
// tests can mock without touching network), strict JSON output, a
// chief-of-staff voice. If OPENAI_API_KEY is unset OR the call fails,
// callers fall back to a deterministic shape (use raw text trimmed,
// flag for review). The route layer (POST /api/capture) decides whether
// to invoke the cleaner at all based on input length — keeping costs
// down for short captures.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8000;

type ChatClient = (args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
}) => Promise<string>;

const defaultChatClient: ChatClient = async ({
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  signal,
}) => {
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("OpenAI response missing content");
  }
  return content;
};

let chatClient: ChatClient = defaultChatClient;

/** Test-only: swap in a fake chat client. Pass null to restore default. */
export function setCaptureChatClient(client: ChatClient | null): void {
  chatClient = client ?? defaultChatClient;
}

export const SYSTEM_PROMPT = `You are this user's quiet, decisive chief of staff. \
The user pastes a brain dump (rambling notes, half-thoughts). Extract a \
clean task from it. \
\
Rules: \
- title: 3 to 7 words. Imperative. Concrete. No emojis, no markdown, no \
  filler words like "Plan to" or "Try to". Reference real people, tools, \
  artifacts, dates if they appear in the text. \
  Bad: "Furniture idea". Good: "Sketch furniture box concept". \
- whyItMatters: one short sentence drawn from the dump explaining the \
  motivation or context. Null only if the dump truly says nothing about \
  why. \
- doneLooksLike: one short sentence describing the concrete outcome. \
  Null if the dump is too vague to infer. \
\
Voice: chief-of-staff, neutral pronouns, no "I" or "me", no app name. \
No second-guessing the user, no advice — just structure what they said. \
\
Return STRICT JSON conforming to: \
  { "title": string, "whyItMatters": string|null, "doneLooksLike": string|null } \
No markdown, no commentary, no extra fields.`;

export interface CaptureContext {
  /** Optional area name to ground the cleaner in scope. */
  areaName: string | null;
  /** Optional area description for extra context. */
  areaDescription: string | null;
}

export interface CaptureCleaned {
  title: string;
  whyItMatters: string | null;
  doneLooksLike: string | null;
}

function buildUserPrompt(text: string, ctx: CaptureContext): string {
  const lines: string[] = [];
  if (ctx.areaName) {
    lines.push(`Area: ${ctx.areaName}`);
    if (ctx.areaDescription) {
      lines.push(`Area description: ${ctx.areaDescription}`);
    }
    lines.push("");
  }
  lines.push("Brain dump:");
  lines.push(text.trim());
  lines.push("");
  lines.push("Return the JSON now.");
  return lines.join("\n");
}

/**
 * Best-effort parse of the model output. Handles minor deviations:
 *   - Stripping ```json fences if the model added them.
 *   - Trimming title to a max of 80 chars (defensive).
 *   - Coercing missing optional fields to null.
 *
 * Throws if the result is unusable (missing/empty title).
 */
function parseCleanResponse(raw: string): CaptureCleaned {
  let stripped = raw.trim();
  if (stripped.startsWith("```")) {
    stripped = stripped.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    throw new Error(
      `capture-cleaner: invalid JSON from model: ${(err as Error).message}`,
    );
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("capture-cleaner: model output is not an object");
  }
  const obj = parsed as Record<string, unknown>;
  const titleRaw = obj["title"];
  if (typeof titleRaw !== "string" || titleRaw.trim().length === 0) {
    throw new Error("capture-cleaner: missing or empty title");
  }
  const title = titleRaw.trim().slice(0, 80);
  const whyRaw = obj["whyItMatters"];
  const why =
    typeof whyRaw === "string" && whyRaw.trim().length > 0
      ? whyRaw.trim()
      : null;
  const doneRaw = obj["doneLooksLike"];
  const done =
    typeof doneRaw === "string" && doneRaw.trim().length > 0
      ? doneRaw.trim()
      : null;
  return { title, whyItMatters: why, doneLooksLike: done };
}

/**
 * Clean a brain dump into a structured task. Pure-ish — no DB access.
 *
 * Throws on AI failure so the route can decide how to fall back. The
 * route layer is responsible for length-gating (don't call this for
 * short captures), supplying area context, and the fallback shape.
 */
export async function cleanBrainDump(
  text: string,
  ctx: CaptureContext,
  apiKey: string,
  options: { model?: string; timeoutMs?: number } = {},
): Promise<CaptureCleaned> {
  const model = options.model ?? DEFAULT_MODEL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const raw = await chatClient({
      apiKey,
      model,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(text, ctx),
      signal: controller.signal,
    });
    return parseCleanResponse(raw);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Deterministic fallback used when AI is unavailable or fails. We never
 * leave the user with a 200-word title rendered in 24pt — instead we
 * truncate to the first sentence-ish chunk and flag for review.
 *
 * Heuristic: take everything up to the first period, comma, or 60 chars,
 * whichever comes first; trim; capitalise; cap at 80 chars.
 */
export function fallbackCleanBrainDump(text: string): CaptureCleaned {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return { title: "Untitled capture", whyItMatters: null, doneLooksLike: null };
  }
  const firstBreakMatch = trimmed.match(/^(.{3,60}?)([.,;!?\n]|$)/);
  let head = firstBreakMatch?.[1] ?? trimmed.slice(0, 60);
  head = head.trim();
  if (head.length === 0) head = trimmed.slice(0, 60);
  // Capitalise first letter.
  const title = head.charAt(0).toUpperCase() + head.slice(1);
  return {
    title: title.slice(0, 80),
    whyItMatters: null,
    doneLooksLike: null,
  };
}

/** Threshold above which we invoke AI. Below: use the text as-is. */
export const AI_CLEAN_THRESHOLD_CHARS = 60;
