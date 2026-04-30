// Phase 3: ask the LLM to break a goal ("milestone") into 5–8 ordered steps.
// Mirrors the briefing/ai.ts pattern (defaultChatClient → fetch → JSON
// response → parse). Same chief-of-staff voice rules: no "I"/"me", no
// app name, decisive short sentences. If OPENAI_API_KEY is unset OR the
// LLM call fails, callers can fall back to a deterministic generic plan
// so the UI never sees a hard error.

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
      temperature: 0.4,
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

export function setBreakdownChatClient(client: ChatClient | null): void {
  chatClient = client ?? defaultChatClient;
}

const SYSTEM_PROMPT = `You are this user's quiet, decisive chief of staff. \
Break the user's goal into 5 to 8 concrete, ordered steps. Each step is one \
short imperative sentence (e.g., "Draft outline." "Send to editor."). Steps \
must be sequenced so each one unblocks the next — earlier steps produce what \
later steps need. Write plainly: short sentences, active verbs, no filler. \
Never use "I" or "me". Do not refer to yourself or this app by name. \
Return STRICT JSON conforming to: { "steps": [string, string, ...] }. \
No markdown, no commentary.`;

function buildUserPrompt(args: { goalTitle: string; areaName: string | null; description: string | null }): string {
  const lines = [
    `Goal: ${args.goalTitle}`,
    args.areaName ? `Pillar: ${args.areaName}` : null,
    args.description ? `Notes: ${args.description}` : null,
    "",
    "Return JSON only: { \"steps\": [\"...\", \"...\"] }. 5 to 8 steps. Ordered.",
  ].filter(Boolean);
  return lines.join("\n");
}

function parseSteps(raw: string): string[] {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const arr = Array.isArray(parsed.steps) ? parsed.steps : [];
  const cleaned = arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
  if (cleaned.length < 3) {
    throw new Error("Breakdown returned too few steps");
  }
  return cleaned;
}

// Deterministic fallback. Used when OPENAI_API_KEY is unset or the LLM
// call fails. Generic enough to be useful for any goal.
export function fallbackSteps(): string[] {
  return [
    "Define scope.",
    "Gather inputs.",
    "Draft v1.",
    "Review.",
    "Revise.",
    "Ship.",
  ];
}

export async function buildBreakdownSteps(
  args: { goalTitle: string; areaName: string | null; description: string | null },
  options: { apiKey: string; model?: string; timeoutMs?: number },
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const raw = await chatClient({
      apiKey: options.apiKey,
      model: options.model ?? DEFAULT_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(args),
      signal: controller.signal,
    });
    return parseSteps(raw);
  } finally {
    clearTimeout(timeout);
  }
}
