import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/guards";
import { getPerformance, listPartners } from "@/server/services/partner.service";
import { reviewPartnerAction } from "@/server/actions/admin.actions";
import { resolveTier } from "@/domain/tiers";
import { PARTNER_STATUSES, type PartnerStatus } from "@/domain/constants";
import { cn } from "@/lib/cn";
import { formatDate, humanize } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { ActionForm } from "@/components/ui/action-form";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Partners" };

export default async function AdminPartnersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser(["admin"]);
  const requested = (await searchParams).status;
  const status = PARTNER_STATUSES.includes(requested as PartnerStatus) ? (requested as PartnerStatus) : undefined;
  const partners = listPartners(status);

  return (
    <>
      <PageHeader title="Partners" description="Review applications and manage Channel Partners." />
      <nav aria-label="Filter partners" className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...PARTNER_STATUSES].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/partners?status=${s}` : "/admin/partners"}
            aria-current={status === s ? "page" : undefined}
            className={cn("rounded-full border px-3 py-1.5 text-sm", status === s ? "border-brand bg-brand-tint font-medium text-brand" : "border-line bg-surface hover:border-line-strong")}
          >
            {s ? humanize(s) : "All"}
          </Link>
        ))}
      </nav>

      <Card>
        {partners.length === 0 ? (
          <EmptyState title="No partners here" />
        ) : (
          <Table>
            <thead><tr><Th>Partner</Th><Th>Profile</Th><Th>Status</Th><Th>Tier · clients</Th><Th>Actions</Th></tr></thead>
            <tbody>
              {partners.map(({ user, profile }) => {
                const perf = getPerformance(user.id);
                return (
                  <tr key={user.id}>
                    <Td>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-ink-muted">{user.email} · {user.phone}</p>
                      <p className="font-mono text-xs text-ink-muted">{profile.code}</p>
                    </Td>
                    <Td className="max-w-xs">
                      <p>{profile.profession}</p>
                      <p className="text-xs text-ink-muted">{user.city}, {profile.region} · applied {formatDate(profile.agreementAcceptedAt)}</p>
                      {profile.experience && <p className="mt-1 text-xs text-ink-soft">“{profile.experience}”</p>}
                    </Td>
                    <Td><StatusBadge status={profile.status} /></Td>
                    <Td className="whitespace-nowrap">
                      {profile.status === "approved" ? <>{resolveTier(perf).name.replace(" Channel Partner", "")} · {perf.activeClients}</> : "—"}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {profile.status !== "approved" && (
                          <ActionForm action={reviewPartnerAction} label="Approve" pendingLabel="Approving…">
                            <input type="hidden" name="partnerId" value={user.id} />
                            <input type="hidden" name="decision" value="approved" />
                          </ActionForm>
                        )}
                        {profile.status === "pending" && (
                          <ActionForm action={reviewPartnerAction} label="Reject" variant="ghost" confirm={`Reject ${user.name}'s application?`}>
                            <input type="hidden" name="partnerId" value={user.id} />
                            <input type="hidden" name="decision" value="rejected" />
                          </ActionForm>
                        )}
                        {profile.status === "approved" && (
                          <ActionForm action={reviewPartnerAction} label="Suspend" variant="ghost" confirm={`Suspend ${user.name}? Their link stops earning commission.`}>
                            <input type="hidden" name="partnerId" value={user.id} />
                            <input type="hidden" name="decision" value="suspended" />
                          </ActionForm>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
