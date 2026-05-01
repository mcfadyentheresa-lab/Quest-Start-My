import type { ReflectionDraft, ReflectionDraftInput } from "./types";

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

export function setReflectionDraftChatClient(client: ChatClient | null): void {
  chatClient = client ?? defaultChatClient;
}

const SYSTEM_PROMPT = `You are this user's quiet, decisive chief of staff. \
Your job is to draft a reflection on the period (week or month) so the user only has to edit, not write from scratch. \
Write plainly: short sentences, active verbs, no filler. Never use "I" or "me" — \
speak in second person to the user, or in neutral third person about the work. \
Do not refer to yourself or this app by name. Reference the user's areas by name when you can. \
You return STRICT JSON conforming to the schema: \
{ "moved": string, "stuck": string, "drop": string, "nextFocus": string }. \
"moved" lists what closed in the period, grouped by area when sensible. \
"stuck" names blocked tasks, stale tasks, or active areas with no progress. \
"drop" suggests what to deactivate, pause, or stop trying to do — areas marked active that didn't move, parked areas with leftover open tasks. \
"nextFocus" is one or two sentences naming the single most important area for the next period and the next concrete step. \
Be specific to the user's data. Use bullet lines starting with "- " inside fields when listing more than one thing. Never invent task titles or areas — only use what's in the input.`;

function buildUserPrompt(input: ReflectionDraftInput): string {
  const areaLines = input.areas
    .map(
      (a) =>
        `- [${a.priority ?? "P3"}] ${a.name}${a.isActiveThisWeek ? " (active)" : ""}${a.portfolioStatus ? ` — ${a.portfolioStatus}` : ""}`,
    )
    .join("\n");

  const completedLines = input.completedTasks
    .slice(0, 30)
    .map(
      (t) =>
        `- "${t.title}" area=${t.areaId ?? "null"} date=${t.date}`,
    )
    .join("\n");

  const openLines = input.openTasks
    .slice(0, 30)
    .map(
      (t) =>
        `- "${t.title}" status=${t.status} area=${t.areaId ?? "null"} date=${t.date}${t.blockerReason ? ` blocker="${t.blockerReason}"` : ""}`,
    )
    .join("\n");

  const milestoneLines = input.milestones
    .slice(0, 20)
    .map((m) => `- "${m.title}" area=${m.areaId} status=${m.status} priority=${m.priority ?? "P3"}`)
    .join("\n");

  return [
    `Period: ${input.periodLabel} (${input.cadence})`,
    `Range: ${input.periodStart} → ${input.periodEnd}`,
    "",
    "AREAS:",
    areaLines || "(none)",
    "",
    "COMPLETED IN PERIOD:",
    completedLines || "(none)",
    "",
    "OPEN AT END OF PERIOD:",
    openLines || "(none)",
    "",
    "GOALS:",
    milestoneLines || "(none)",
    "",
    "Return JSON only, no markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

function takeString(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

export async function buildAiDraft(
  input: ReflectionDraftInput,
  options: { apiKey: string; model?: string; timeoutMs?: number },
): Promise<ReflectionDraft> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const raw = await chatClient({
      apiKey: options.apiKey,
      model: options.model ?? DEFAULT_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input),
      signal: controller.signal,
    });
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      moved: takeString(parsed.moved),
      stuck: takeString(parsed.stuck),
      drop: takeString(parsed.drop),
      nextFocus: takeString(parsed.nextFocus),
      source: "ai",
      generatedAt: input.now.toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
