// Phase 3: ask the LLM to break a goal ("milestone") into 3–10 ordered steps.
// Mirrors the briefing/ai.ts pattern (defaultChatClient → fetch → JSON
// response → parse). Same chief-of-staff voice rules: no "I"/"me", no
// app name, decisive short sentences. If OPENAI_API_KEY is unset OR the
// LLM call fails, callers can fall back to a deterministic plan that
// references the goal/area names so the UI never sees a hard error.

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
      temperature: 0.3,
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
Break the user's goal into between 3 and 10 concrete, ordered steps. Each step \
is one short imperative sentence (e.g., "Draft outline." "Send to editor."). \
\
Specificity rules: \
- Reference real artifacts, people, tools, or dates from the goal description \
  and area context where they exist. \
- Bad (generic): "Define scope." "Gather inputs." "Draft v1." "Review." \
- Good (specific): "Outline the three pages on the Aster site rebuild." \
  "Confirm homepage hero copy with Sara on Friday." \
- If the goal has existing steps, write NEW steps that move the goal forward \
  beyond what is already there. Do not duplicate. \
\
Sequencing: each step unblocks the next. Right-size: each step completable in \
one to four 25-minute focus blocks. Voice: chief-of-staff, neutral pronouns, \
no "I" or "me", no app name. \
\
No filler. If a specific step cannot be written, return fewer steps rather \
than padding with generic phrases like "Plan" or "Review". Minimum 3, maximum \
10. \
\
Return STRICT JSON conforming to: { "steps": [string, string, ...] }. No \
markdown, no commentary.`;

export interface BreakdownContext {
  goalTitle: string;
  goalDescription: string | null;
  areaName: string | null;
  areaDescription: string | null;
  areaPriority: string | null;
  areaActiveThisWeek: boolean | null;
  existingStepTitles: string[];
  recentlyCompletedTitles: string[];
  todayIso: string;
}

const FEW_SHOT = `Example
-------
Goal: Move out of the apartment by June 1
Notes: Heading from Brooklyn to Cambridge for the new job. Lease ends June 1. \
Furniture mostly going, the couch is not.
Pillar: Life logistics (P2, active this week)
Today: 2026-04-15

Output:
{
  "steps": [
    "Confirm move-out date with the landlord and get the walkthrough slot in writing.",
    "Book a moving van for Saturday May 30 with at least one helper.",
    "List the couch and side table on Buy Nothing Brooklyn with pickup before May 28.",
    "Forward mail to the Cambridge address through USPS.",
    "Pack the kitchen and books the weekend of May 23.",
    "Take meter readings and photos of every room on May 31."
  ]
}`;

export function buildUserPrompt(ctx: BreakdownContext): string {
  const lines: (string | null)[] = [];
  lines.push(FEW_SHOT);
  lines.push("");
  lines.push("Now do the same for this goal.");
  lines.push("");
  lines.push(`Goal: ${ctx.goalTitle}`);
  if (ctx.goalDescription && ctx.goalDescription.trim().length > 0) {
    lines.push(`Notes: ${ctx.goalDescription.trim()}`);
  }
  if (ctx.areaName) {
    const flags: string[] = [];
    if (ctx.areaPriority) flags.push(ctx.areaPriority);
    if (ctx.areaActiveThisWeek === true) flags.push("active this week");
    else if (ctx.areaActiveThisWeek === false) flags.push("not active this week");
    const tail = flags.length > 0 ? ` (${flags.join(", ")})` : "";
    lines.push(`Pillar: ${ctx.areaName}${tail}`);
    if (ctx.areaDescription && ctx.areaDescription.trim().length > 0) {
      lines.push(`Pillar notes: ${ctx.areaDescription.trim()}`);
    }
  }
  if (ctx.existingStepTitles.length > 0) {
    lines.push("");
    lines.push("Existing steps already on this goal (do NOT duplicate):");
    for (const t of ctx.existingStepTitles) {
      lines.push(`- ${t}`);
    }
  }
  if (ctx.recentlyCompletedTitles.length > 0) {
    lines.push("");
    lines.push("Recently completed in this pillar (rhythm and language signal):");
    for (const t of ctx.recentlyCompletedTitles) {
      lines.push(`- ${t}`);
    }
  }
  lines.push("");
  lines.push(`Today: ${ctx.todayIso}`);
  lines.push("");
  lines.push(
    "Return JSON only: { \"steps\": [\"...\", \"...\"] }. Between 3 and 10 ordered steps. Specific. No filler.",
  );
  return lines.filter((l) => l !== null).join("\n");
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

// Deterministic fallback. Used when OPENAI_API_KEY is unset or the LLM call
// fails. References the goal title (and area name when available) so the
// output is at least specific to what the user typed, not pure boilerplate.
// Honest about being a template — the rules path is supposed to look
// deterministic.
export function fallbackSteps(args: {
  goalTitle: string;
  areaName?: string | null;
}): string[] {
  const goal = args.goalTitle.trim();
  const area = (args.areaName ?? "").trim();
  const inArea = area.length > 0 ? ` for ${area}` : "";
  return [
    `Outline scope of ${goal}.`,
    `Block first focus session on ${goal}${inArea}.`,
    `Capture open questions about ${goal}.`,
    `Identify who or what needs to weigh in on ${goal}.`,
    `Draft the first concrete artifact for ${goal}.`,
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
