import { queryOne } from "@/lib/server/db";

/** Liveness + database check for load balancers and uptime monitors. No auth, no data. */
export async function GET() {
  try {
    await queryOne("SELECT 1");
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
