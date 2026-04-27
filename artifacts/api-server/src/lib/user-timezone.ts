import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { resolveTimezone } from "./time";

/** Look up a user's timezone from the users table, falling back to the
 * default if the row is missing or the column is empty. */
export async function getUserTimezone(userId: string): Promise<string> {
  const rows = await db
    .select({ timezone: usersTable.timezone })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  return resolveTimezone(rows[0]?.timezone ?? null);
}
