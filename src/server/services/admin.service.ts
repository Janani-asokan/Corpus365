import { and, count, countDistinct, desc, eq, gte, sum } from "drizzle-orm";
import { db } from "@/server/db/client";
import { auditEvents, commissions, orders, partnerProfiles, quoteRequests, subscriptions, users } from "@/server/db/schema";

export function getAdminMetrics(now = new Date()) {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenue = db.select({ total: sum(orders.subtotal) }).from(orders).where(eq(orders.status, "paid")).get();
  const revenueThisMonth = db
      .select({ total: sum(orders.subtotal) })
      .from(orders)
      .where(and(eq(orders.status, "paid"), gte(orders.paidAt, monthStart)))
      .get();
  const payingClients = db.select({ value: countDistinct(subscriptions.userId) }).from(subscriptions).where(eq(subscriptions.status, "active")).get();
  const trials = db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, "trialing")).get();
  const partners = db
    .select({ status: partnerProfiles.status, value: count() })
    .from(partnerProfiles)
    .groupBy(partnerProfiles.status)
    .all();
  const commissionTotal = db.select({ total: sum(commissions.amount) }).from(commissions).where(eq(commissions.status, "paid")).get();
  const commissionOwed = db.select({ total: sum(commissions.amount) }).from(commissions).where(eq(commissions.status, "pending")).get();
  const openQuotes = db.select({ value: count() }).from(quoteRequests).where(eq(quoteRequests.status, "open")).get();
  const allCommission = db.select({ total: sum(commissions.amount) }).from(commissions).get();

  const revenueTotal = Number(revenue?.total ?? 0);
  return {
    revenueTotal,
    revenueThisMonth: Number(revenueThisMonth?.total ?? 0),
    payingClients: payingClients?.value ?? 0,
    trials: trials?.value ?? 0,
    partnersApproved: partners.find((p) => p.status === "approved")?.value ?? 0,
    partnersPending: partners.find((p) => p.status === "pending")?.value ?? 0,
    commissionPaid: Number(commissionTotal?.total ?? 0),
    commissionOwed: Number(commissionOwed?.total ?? 0),
    /** Channel cost of revenue (target < 30%). */
    channelCostShare: revenueTotal > 0 ? Number(allCommission?.total ?? 0) / revenueTotal : 0,
    openQuotes: openQuotes?.value ?? 0,
  };
}

export function listRecentAudit(limit = 20) {
  return db
    .select({ event: auditEvents, actor: users.name })
    .from(auditEvents)
    .leftJoin(users, eq(users.id, auditEvents.actorId))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .all();
}
