import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db/client";
import { first } from "@/server/db/query";
import { auditEvents, commissions, orders, partnerProfiles as pp, quoteRequests, subscriptions, users } from "@/server/db/schema";

/** Dashboard metrics, each aggregated in a single query. */
export async function getAdminMetrics(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const money = (expr: ReturnType<typeof sql>) => sql<number>`coalesce(${expr}, 0)`.mapWith(Number);

  const [revenue, subs, partners, commission, quotes] = await Promise.all([
    first(
      db
        .select({
          total: money(sql`sum(${orders.subtotal}) filter (where ${orders.status} = 'paid')`),
          thisMonth: money(sql`sum(${orders.subtotal}) filter (where ${orders.status} = 'paid' and ${orders.paidAt} >= ${monthStart})`),
        })
        .from(orders),
    ),
    first(
      db
        .select({
          paying: sql<number>`count(distinct ${subscriptions.userId}) filter (where ${subscriptions.status} = 'active')`.mapWith(Number),
          trials: sql<number>`count(*) filter (where ${subscriptions.status} = 'trialing')`.mapWith(Number),
        })
        .from(subscriptions),
    ),
    db.select({ status: pp.status, value: count() }).from(pp).groupBy(pp.status),
    first(
      db
        .select({
          paid: money(sql`sum(${commissions.amount}) filter (where ${commissions.status} = 'paid')`),
          owed: money(sql`sum(${commissions.amount}) filter (where ${commissions.status} = 'pending')`),
          all: money(sql`sum(${commissions.amount}) filter (where ${commissions.status} <> 'reversed')`),
        })
        .from(commissions),
    ),
    first(db.select({ value: count() }).from(quoteRequests).where(eq(quoteRequests.status, "open"))),
  ]);

  const revenueTotal = revenue?.total ?? 0;
  return {
    revenueTotal,
    revenueThisMonth: revenue?.thisMonth ?? 0,
    payingClients: subs?.paying ?? 0,
    trials: subs?.trials ?? 0,
    partnersApproved: partners.find((p) => p.status === "approved")?.value ?? 0,
    partnersPending: partners.find((p) => p.status === "pending")?.value ?? 0,
    commissionPaid: commission?.paid ?? 0,
    commissionOwed: commission?.owed ?? 0,
    /** Channel cost of revenue (target < 30%). */
    channelCostShare: revenueTotal > 0 ? (commission?.all ?? 0) / revenueTotal : 0,
    openQuotes: quotes?.value ?? 0,
  };
}

export async function listRecentAudit(limit = 20) {
  return db
    .select({ event: auditEvents, actor: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}

