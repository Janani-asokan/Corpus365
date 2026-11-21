import type { Metadata } from "next";
import { Trash2, Users } from "lucide-react";
import { requireUser } from "@/server/auth/guards";
import { listPartnerClients } from "@/server/services/partner.service";
import { listLeads } from "@/server/services/lead.service";
import { listProducts } from "@/server/services/catalog.service";
import { deleteLeadAction } from "@/server/actions/partner.actions";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadStatusSelect, NewLeadForm } from "@/components/partner/lead-forms";

export const metadata: Metadata = { title: "Clients & leads" };

export default async function PartnerClientsPage() {
  const user = await requireUser(["partner"]);
  const clients = await listPartnerClients(user.id);
  const leads = await listLeads(user.id);
  const products = await listProducts();
  const productName = new Map(products.map((p) => [p.id, p.name]));

  return (
    <>
      <PageHeader title="Clients & leads" description="Businesses you look after, and the ones you’re talking to." />

      <Card>
        <CardHeader title={`Your clients (${clients.length})`} description="Only your own referred clients count towards your tier." />
        {clients.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="No clients yet">When a business buys or starts a trial through your link or code, they appear here.</EmptyState>
        ) : (
          <Table>
            <thead><tr><Th>Business</Th><Th>Contact</Th><Th>Apps</Th><Th>Next date</Th></tr></thead>
            <tbody>
              {clients.map(({ client, subscriptions }) => (
                <tr key={client.userId}>
                  <Td>
                    <p className="font-medium">{client.companyName ?? client.name}</p>
                    <p className="text-xs text-ink-muted">{client.city}</p>
                  </Td>
                  <Td>
                    <p>{client.name}</p>
                    <p className="text-xs text-ink-muted">{client.phone ?? client.email}</p>
                  </Td>
                  <Td>
                    <ul className="space-y-1">
                      {subscriptions.map((s) => (
                        <li key={s.productId} className="flex flex-wrap items-center gap-2">
                          <span>{productName.get(s.productId)}</span>
                          <StatusBadge status={s.status} />
                        </li>
                      ))}
                    </ul>
                  </Td>
                  <Td className="whitespace-nowrap">{formatDate(subscriptions[0]?.currentPeriodEnd)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader title={`Leads (${leads.length})`} description="Track prospects from first chat to signed client." />
          {leads.length === 0 ? (
            <EmptyState title="No leads yet">Add businesses you’re talking to so you remember to follow up.</EmptyState>
          ) : (
            <Table>
              <thead><tr><Th>Business</Th><Th>Interest</Th><Th>Status</Th><Th><span className="sr-only">Delete</span></Th></tr></thead>
              <tbody>
                {leads.map(({ lead, productName: interest }) => (
                  <tr key={lead.id}>
                    <Td>
                      <p className="font-medium">{lead.businessName}</p>
                      <p className="text-xs text-ink-muted">{lead.contactName} · {lead.phone ?? lead.email}</p>
                      {lead.notes && <p className="mt-1 text-xs text-ink-soft">{lead.notes}</p>}
                    </Td>
                    <Td>{interest ?? "—"}</Td>
                    <Td><LeadStatusSelect leadId={lead.id} status={lead.status} label={lead.businessName} /></Td>
                    <Td>
                      <form action={deleteLeadAction}>
                        <input type="hidden" name="leadId" value={lead.id} />
                        <button type="submit" className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-danger-tint hover:text-danger" aria-label={`Delete lead ${lead.businessName}`}>
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </form>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="p-5 xl:self-start">
          <h2 className="mb-4 font-semibold">Add a lead</h2>
          <NewLeadForm products={products.map((p) => ({ id: p.id, name: p.name }))} />
        </Card>
      </div>
    </>
  );
}
