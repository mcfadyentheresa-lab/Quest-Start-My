import type { BriefingInput, BriefingItem, BriefingResponse, BriefingPriority } from "./types";

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

export function setBriefingChatClient(client: ChatClient | null): void {
  chatClient = client ?? defaultChatClient;
}

// Phase 3 chief-of-staff voice update.
// Goal: the briefing should read like a person handing the user a plan,
// not a checklist generator. Decisive, neutral pronouns (no "I"/"me"),
// no app name (TBD branding). Headline names the one thing that matters.
const SYSTEM_PROMPT = `You are this user's quiet, decisive chief of staff. \
Your job is to hand them a short daily briefing that names what matters today and why. \
Write plainly: short sentences, active verbs, no filler. Never use "I" or "me" \
— speak in second person to the user, or in neutral third person about the plan. \
Do not refer to yourself or this app by name. Always reference the user's pillars \
and weekly priorities by name. \
You return STRICT JSON conforming to the schema: \
{ "headline": string, "context": string, "briefing": [{ "taskId": number|null, "title": string, "pillarName": string, "priority": "P1"|"P2"|"P3"|"P4", "reasoning": string, "suggestedNextStep": string|null }], "signoff": string }. \
Pick at most 3 items. The first item is the one that most matters today; "headline" \
should stand on its own as a single short sentence telling the user what to do first \
(e.g., "Lock in the ASL site copy today — everything else can wait."). \
Each "reasoning" begins with "Surfaced because" and is one sentence. \
"context" is one sentence narrating WHY this plan, ideally referencing recent momentum or a P1 pillar. \
"signoff" is one warm closing line. NEVER invent task IDs — set taskId to one in the input or null for new suggestions.`;

function buildUserPrompt(input: BriefingInput): string {
  const pillarLines = input.pillars
    .map(
      (p) =>
        `- [${p.priority ?? "P3"}] ${p.name}${p.isActiveThisWeek ? " (active this week)" : ""}${p.portfolioStatus ? ` — ${p.portfolioStatus}` : ""}${p.nowFocus ? ` — now: ${p.nowFocus}` : ""}`,
    )
    .join("\n");

  const weeklyLines = input.weeklyPlan
    ? [
        input.weeklyPlan.priorities.length > 0
          ? `Weekly priorities: ${input.weeklyPlan.priorities.join("; ")}`
          : null,
        input.weeklyPlan.businessFocus ? `Business focus: ${input.weeklyPlan.businessFocus}` : null,
        input.weeklyPlan.creativeFocus ? `Creative focus: ${input.weeklyPlan.creativeFocus}` : null,
        input.weeklyPlan.healthFocus ? `Health focus: ${input.weeklyPlan.healthFocus}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "(no weekly plan yet)";

  const openLines = input.openTasks
    .slice(0, 25)
    .map(
      (t) =>
        `- id=${t.id} status=${t.status} title="${t.title}" pillarId=${t.areaId ?? "null"}${t.suggestedNextStep ? ` next="${t.suggestedNextStep}"` : ""}${t.blockerReason ? ` blocker="${t.blockerReason}"` : ""}`,
    )
    .join("\n");

  const recentLines = input.recentlyCompleted
    .slice(0, 10)
    .map((t) => `- "${t.title}" (${t.date})`)
    .join("\n");

  return [
    `Today's date: ${input.date}`,
    `User first name: ${input.userFirstName}`,
    `Local hour: ${input.hourLocal}`,
    "",
    "PILLARS:",
    pillarLines || "(none)",
    "",
    "WEEKLY PLAN:",
    weeklyLines,
    "",
    "OPEN TASKS:",
    openLines || "(none)",
    "",
    "RECENTLY COMPLETED:",
    recentLines || "(none)",
    "",
    input.hint ? `HINT FROM USER: ${input.hint}` : "",
    "",
    "Return JSON only, no markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

function isPriority(value: unknown): value is BriefingPriority {
  return value === "P1" || value === "P2" || value === "P3" || value === "P4";
}

function parseAiResponse(
  raw: string,
  input: BriefingInput,
): { headline: string; context: string; signoff: string; items: BriefingItem[] } {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const briefingArr = Array.isArray(parsed.briefing) ? parsed.briefing : [];
  const taskMap = new Map(input.openTasks.map((t) => [t.id, t]));
  const pillarById = new Map(input.pillars.map((p) => [p.id, p]));
  const pillarByName = new Map(input.pillars.map((p) => [p.name.toLowerCase(), p]));

  const items: BriefingItem[] = [];
  for (const entry of briefingArr.slice(0, 3)) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const titleRaw = typeof e.title === "string" ? e.title.trim() : "";
    if (!titleRaw) continue;

    let taskId: number | null = null;
    if (typeof e.taskId === "number" && taskMap.has(e.taskId)) taskId = e.taskId;

    const referencedTask = taskId !== null ? taskMap.get(taskId) ?? null : null;

    const pillarNameRaw = typeof e.pillarName === "string" ? e.pillarName : "";
    let pillar = pillarByName.get(pillarNameRaw.toLowerCase()) ?? null;
    if (!pillar && referencedTask?.areaId !== undefined && referencedTask.areaId !== null) {
      pillar = pillarById.get(referencedTask.areaId) ?? null;
    }

    const priority = isPriority(e.priority) ? e.priority : "P3";
    const reasoning =
      typeof e.reasoning === "string" && e.reasoning.trim().length > 0
        ? e.reasoning.trim()
        : `Surfaced because it advances ${pillar?.name ?? "your plan"}.`;
    const suggestedNextStep =
      typeof e.suggestedNextStep === "string" && e.suggestedNextStep.trim().length > 0
        ? e.suggestedNextStep.trim()
        : referencedTask?.suggestedNextStep ?? null;

    items.push({
      taskId,
      title: titleRaw,
      pillarName: pillar?.name ?? (pillarNameRaw || "Focus"),
      pillarColor: pillar?.color ?? null,
      priority,
      reasoning,
      estimatedMinutes: input.focusBlockMinutes,
      suggestedNextStep,
      blockedBy:
        referencedTask?.status === "blocked"
          ? (referencedTask.blockerReason ?? "Blocked")
          : null,
    });
  }

  return {
    headline: typeof parsed.headline === "string" ? parsed.headline : `${items.length === 1 ? "One" : items.length === 2 ? "Two" : "Three"} things matter today.`,
    context:
      typeof parsed.context === "string" && parsed.context.trim().length > 0
        ? parsed.context
        : "Here's what your assistant put on the radar for today.",
    signoff:
      typeof parsed.signoff === "string" && parsed.signoff.trim().length > 0
        ? parsed.signoff
        : "I've got the rest of the week on the radar. Tap any item to start.",
    items,
  };
}

function timeOfDayGreeting(hour: number, name: string): string {
  if (hour < 12) return `Good morning, ${name}.`;
  if (hour < 17) return `Good afternoon, ${name}.`;
  return `Good evening, ${name}.`;
}

export async function buildAiBriefing(
  input: BriefingInput,
  options: { apiKey: string; model?: string; timeoutMs?: number },
): Promise<BriefingResponse> {
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
    const parsed = parseAiResponse(raw, input);
    return {
      greeting: timeOfDayGreeting(input.hourLocal, input.userFirstName),
      headline: parsed.headline,
      context: parsed.context,
      briefing: parsed.items,
      signoff: parsed.signoff,
      date: input.date,
      source: "ai",
      approved: false,
      generatedAt: input.now.toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
