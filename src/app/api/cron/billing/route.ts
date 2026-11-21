import { timingSafeEqual } from "node:crypto";
import { processDueRenewals } from "@/server/services/billing.service";

export const dynamic = "force-dynamic";

/**
 * Daily billing job for an external scheduler (cron, Render/GitHub cron, etc.):
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/billing
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET not configured", { status: 503 });

  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await processDueRenewals();
  console.info("[billing] run", result);
  return Response.json(result);
}
