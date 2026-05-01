// Phase 3: ask the LLM to break a goal ("milestone") into 3–10 ordered steps.
// Mirrors the briefing/ai.ts pattern (defaultChatClient → fetch → JSON
// response → parse). Same chief-of-staff voice rules: no "I"/"me", no
// app name, decisive short sentences. If OPENAI_API_KEY is unset OR the
// LLM call fails, callers can fall back to a deterministic generic plan
// so the UI never sees a hard error.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TEMPERATURE = 0.2;

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
      temperature: DEFAULT_TEMPERATURE,
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

export const SYSTEM_PROMPT = `You are this user's quiet, decisive chief of staff. \
Break the user's goal into 3 to 10 concrete, ordered steps that build on each other — earlier steps must produce what later steps need. \
Every step is one short imperative sentence (under 90 characters). \
Each step must be specific: name real artifacts, people, tools, or decisions where the input gives them. Never write generic placeholders like "Plan it.", "Do it.", "Review.", "Iterate.". \
Right-size each step so it can be completed in one to four 25-minute focus blocks. \
Match the user's chief-of-staff voice: neutral, decisive, no "I" or "me", no second-person commands like "you should". Do not refer to yourself or this app by name. \
If existing steps are listed, do not duplicate them — return only NEW steps that complement what's already there. \
Return STRICT JSON conforming to: { "steps": [string, ...] }. No markdown, no commentary, no leading/trailing text.

Few-shot example.
Goal: "Move into the new apartment by month-end."
Area: "Home" (P1, Active this week). Status: in progress.
Description: "Closing date is the 28th. Movers booked. Boxes mostly packed."
Existing steps: none.
Recent activity: "Booked the moving crew."
Good output:
{ "steps": [
  "Confirm elevator reservation with both buildings.",
  "Pack the kitchen — pantry first, then small appliances.",
  "Label every box by destination room and priority.",
  "Forward mail and update the address on driver's license + bank.",
  "Walk the new place day-of, photograph any pre-existing damage.",
  "Direct movers room-by-room from the labeled inventory.",
  "Unpack the bedroom and bathroom essentials before sleeping there."
] }`;

export interface BreakdownContext {
  goalTitle: string;
  goalDescription: string | null;
  areaName: string | null;
  areaDescription: string | null;
  areaPriority: string | null;
  areaIsActiveThisWeek: boolean | null;
  existingStepTitles: string[];
  recentCompletedTitle: string | null;
}

export function buildUserPrompt(ctx: BreakdownContext): string {
  const lines: string[] = [];
  lines.push(`Goal: ${ctx.goalTitle}`);
  if (ctx.goalDescription) {
    lines.push(`Description: ${ctx.goalDescription}`);
  }

  if (ctx.areaName) {
    const meta: string[] = [];
    if (ctx.areaPriority) meta.push(ctx.areaPriority);
    if (ctx.areaIsActiveThisWeek !== null) {
      meta.push(ctx.areaIsActiveThisWeek ? "Active this week" : "Not active this week");
    }
    const metaSuffix = meta.length > 0 ? ` (${meta.join(", ")})` : "";
    lines.push(`Area: ${ctx.areaName}${metaSuffix}`);
    if (ctx.areaDescription) {
      lines.push(`Area context: ${ctx.areaDescription}`);
    }
  }

  if (ctx.existingStepTitles.length > 0) {
    lines.push("Existing steps (do NOT repeat):");
    for (const t of ctx.existingStepTitles) {
      lines.push(`  - ${t}`);
    }
  } else {
    lines.push("Existing steps: none.");
  }

  if (ctx.recentCompletedTitle) {
    lines.push(`Most recent completed work in this area: ${ctx.recentCompletedTitle}`);
  }

  lines.push("");
  lines.push('Return JSON only: { "steps": ["...", "..."] }. 3 to 10 specific, ordered steps.');
  return lines.join("\n");
}

function parseSteps(raw: string): string[] {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const arr = Array.isArray(parsed.steps) ? parsed.steps : [];
  const cleaned = arr
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 10);
  if (cleaned.length < 3) {
    throw new Error("Breakdown returned too few steps");
  }
  return cleaned;
}

// Deterministic fallback. Used when OPENAI_API_KEY is unset or the LLM
// call fails. Three concrete steps that work for almost any goal —
// better than "Plan / Do / Review."
export function fallbackSteps(): string[] {
  return [
    "Outline scope.",
    "Block first focus session.",
    "Capture open questions.",
  ];
}

export async function buildBreakdownSteps(
  ctx: BreakdownContext,
  options: { apiKey: string; model?: string; timeoutMs?: number },
): Promise<string[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const raw = await chatClient({
      apiKey: options.apiKey,
      model: options.model ?? DEFAULT_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(ctx),
      signal: controller.signal,
    });
    return parseSteps(raw);
  } finally {
    clearTimeout(timeout);
  }
}
