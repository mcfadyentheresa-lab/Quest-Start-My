import * as zod from "zod";

export const RecapTaskRef = zod.object({
  taskId: zod.number().int().nullable(),
  title: zod.string(),
  pillarName: zod.string(),
  pillarColor: zod.string().nullable(),
});
export type RecapTaskRef = zod.infer<typeof RecapTaskRef>;

export const RecapResponse = zod.object({
  greeting: zod.string(),
  headline: zod.string(),
  closedToday: zod.array(RecapTaskRef),
  rolledToTomorrow: zod.array(RecapTaskRef),
  areaBreakdown: zod.string(),
  reflectionPrompt: zod.string(),
  reflection: zod.string().nullable(),
  signoff: zod.string(),
  date: zod.string(),
  source: zod.enum(["ai", "rules", "fallback"]),
  generatedAt: zod.string(),
});
export type RecapResponse = zod.infer<typeof RecapResponse>;

export const RecapReflectionBody = zod.object({
  reflection: zod.string().max(1000),
});
export type RecapReflectionBody = zod.infer<typeof RecapReflectionBody>;
