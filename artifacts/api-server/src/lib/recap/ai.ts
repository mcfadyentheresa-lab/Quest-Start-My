import type { Area, Task } from "@workspace/db";
import type {
  RecapAreaBreakdown,
  RecapInput,
  RecapResponse,
  RecapTaskRef,
} from "./types";
import { computeAreaBreakdown, pickReflectionPrompt } from "./rules";

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

export function setRecapChatClient(client: ChatClient | null): void {
  chatClient = client ?? defaultChatClient;
}

const SYSTEM_PROMPT = `You are a confident, gentle chief of staff for a CEO building a portfolio of meaningful work. \
Your job is to write a short evening recap that names what closed today, what rolled into tomorrow, and where time went. \
Tone: warm, decisive, end-of-day. Never tentative, never with empty filler. Match the voice of the morning briefing. \
You return STRICT JSON conforming to this schema: \
{ "headline": string, "areaBreakdown": string, "reflectionPrompt": string, "signoff": string }. \
"headline" is one short line summarizing the day (e.g., "Solid day — closed 4 of 5."). \
"areaBreakdown" is one sentence narrating where today's effort lived, referencing area names from the input. \
"reflectionPrompt" is one short open question for the user to reflect on (single sentence, ends with "?"). \
"signoff" is one warm closing line, brief.`;

function buildUserPrompt(
  input: RecapInput,
  closedRefs: RecapTaskRef[],
  rolledRefs: RecapTaskRef[],
  breakdown: RecapAreaBreakdown[],
): string {
  const closedLines = closedRefs.length > 0
    ? closedRefs.map((t) => `- "${t.title}" (${t.pillarName})`).join("\n")
    : "(nothing closed)";
  const rolledLines = rolledRefs.length > 0
    ? rolledRefs.map((t) => `- "${t.title}" (${t.pillarName})`).join("\n")
    : "(nothing rolled — clear day ahead)";
  const breakdownLines = breakdown.length > 0
    ? breakdown.map((b) => `- ${b.pillarName}: ${b.closedCount} closed`).join("\n")
    : "(no closed items)";

  return [
    `Today's date: ${input.date}`,
    `User first name: ${input.userFirstName}`,
    `Local hour: ${input.hourLocal}`,
    "",
    "CLOSED TODAY:",
    closedLines,
    "",
    "ROLLED TO TOMORROW (still pending/blocked at end of day):",
    rolledLines,
    "",
    "AREA BREAKDOWN (closed counts):",
    breakdownLines,
    "",
    "Return JSON only, no markdown.",
  ]
    .filter(Boolean)
    .join("\n");
}

function toTaskRef(task: Task, pillarMap: Map<number, Area>): RecapTaskRef {
  const pillar = task.areaId !== null ? pillarMap.get(task.areaId) : undefined;
  return {
    taskId: task.id,
    title: task.title,
    pillarName: pillar?.name ?? "Unassigned",
    pillarColor: pillar?.color ?? null,
  };
}

function parseAiResponse(raw: string): {
  headline: string;
  areaBreakdown: string;
  reflectionPrompt: string;
  signoff: string;
} {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const headline = typeof parsed.headline === "string" && parsed.headline.trim().length > 0
    ? parsed.headline.trim()
    : "Day's done.";
  const areaBreakdown = typeof parsed.areaBreakdown === "string" && parsed.areaBreakdown.trim().length > 0
    ? parsed.areaBreakdown.trim()
    : "Today's effort spread across your active areas.";
  const reflectionPrompt = typeof parsed.reflectionPrompt === "string" && parsed.reflectionPrompt.trim().length > 0
    ? parsed.reflectionPrompt.trim()
    : "What surprised you today?";
  const signoff = typeof parsed.signoff === "string" && parsed.signoff.trim().length > 0
    ? parsed.signoff.trim()
    : "Rest up. Tomorrow's plan is staged.";
  return { headline, areaBreakdown, reflectionPrompt, signoff };
}

export async function buildAiRecap(
  input: RecapInput,
  options: { apiKey: string; model?: string; timeoutMs?: number },
): Promise<RecapResponse> {
  const pillarMap = new Map(input.pillars.map((p) => [p.id, p]));
  const closedRefs = input.closedToday.map((t) => toTaskRef(t, pillarMap));
  const rolledRefs = input.openToday.map((t) => toTaskRef(t, pillarMap));
  const breakdown = computeAreaBreakdown(input.closedToday, input.pillars);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const raw = await chatClient({
      apiKey: options.apiKey,
      model: options.model ?? DEFAULT_MODEL,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt: buildUserPrompt(input, closedRefs, rolledRefs, breakdown),
      signal: controller.signal,
    });
    const parsed = parseAiResponse(raw);
    return {
      greeting: `Evening, ${input.userFirstName}.`,
      headline: parsed.headline,
      closedToday: closedRefs,
      rolledToTomorrow: rolledRefs,
      areaBreakdown: parsed.areaBreakdown,
      reflectionPrompt: parsed.reflectionPrompt || pickReflectionPrompt(input.reflectionPromptIndex),
      reflection: null,
      signoff: parsed.signoff,
      date: input.date,
      source: "ai",
      generatedAt: input.now.toISOString(),
    };
  } finally {
    clearTimeout(timeout);
  }
}
