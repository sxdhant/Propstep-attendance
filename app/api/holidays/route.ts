import { z } from "zod";
import { audit } from "@/lib/server/audit";
import { query } from "@/lib/server/db";
import { csrfGuard, failure, readJson, requireUser, success } from "@/lib/server/http";
import { loadHolidayMap } from "@/lib/server/repo";

const holiday = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(80),
});

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  const map = await loadHolidayMap();
  return success(Object.entries(map).map(([date, name]) => ({ date, name })).sort((a, b) => a.date.localeCompare(b.date)));
}

/** Adds or renames a holiday (one per date). Admin only. */
export async function POST(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const parsed = holiday.safeParse(await readJson(request));
  if (!parsed.success) return failure("Enter a valid date and holiday name.");
  try {
    await query("INSERT INTO holidays (date, name) VALUES ($1,$2) ON CONFLICT (date) DO UPDATE SET name = EXCLUDED.name", [
      parsed.data.date,
      parsed.data.name,
    ]);
  } catch {
    return failure("That is not a valid calendar date.");
  }
  await audit("holiday.saved", { actorUserId: auth.user.userId, target: parsed.data.date });
  return success(parsed.data, 201);
}

export async function DELETE(request: Request) {
  const blocked = await csrfGuard();
  if (blocked) return blocked;
  const auth = await requireUser("admin");
  if ("response" in auth) return auth.response;
  const parsed = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(await readJson(request));
  if (!parsed.success) return failure("Provide the holiday date.");
  const rows = await query("DELETE FROM holidays WHERE date = $1 RETURNING date", [parsed.data.date]);
  if (rows.length === 0) return failure("Holiday not found.", 404);
  await audit("holiday.deleted", { actorUserId: auth.user.userId, target: parsed.data.date });
  return success({});
}
