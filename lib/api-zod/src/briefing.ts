import * as zod from "zod";

export const BriefingPriority = zod.enum(["P1", "P2", "P3", "P4"]);
export type BriefingPriority = zod.infer<typeof BriefingPriority>;

export const BriefingItem = zod.object({
  taskId: zod.union([zod.string(), zod.number()]).nullable(),
  title: zod.string(),
  pillarName: zod.string(),
  pillarColor: zod.string().nullable(),
  goalId: zod.number().int().nullable(),
  goalTitle: zod.string().nullable(),
  priority: BriefingPriority,
  reasoning: zod.string(),
  estimatedMinutes: zod.number().int().positive(),
  suggestedNextStep: zod.string().nullable(),
  blockedBy: zod.string().nullable(),
});
export type BriefingItem = zod.infer<typeof BriefingItem>;

export const BriefingResponse = zod.object({
  greeting: zod.string(),
  headline: zod.string(),
  context: zod.string(),
  briefing: zod.array(BriefingItem).max(3),
  signoff: zod.string(),
  date: zod.string(),
  source: zod.enum(["ai", "rules", "fallback"]),
  approved: zod.boolean(),
  generatedAt: zod.string(),
});
export type BriefingResponse = zod.infer<typeof BriefingResponse>;

export const BriefingActionResponse = zod.object({
  ok: zod.boolean(),
  briefing: BriefingResponse.nullable(),
});
export type BriefingActionResponse = zod.infer<typeof BriefingActionResponse>;

export const BriefingReshuffleBody = zod.object({
  hint: zod.string().optional(),
});
export type BriefingReshuffleBody = zod.infer<typeof BriefingReshuffleBody>;
