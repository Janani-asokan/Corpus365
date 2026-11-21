import type { Metadata } from "next";
import { requireUser } from "@/server/auth/guards";
import { listQuoteRequests } from "@/server/services/quote.service";
import { setQuoteStatusAction } from "@/server/actions/admin.actions";
import { QUOTE_STATUSES } from "@/domain/constants";
import { formatDate, humanize } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Quote requests" };

export default async function AdminQuotesPage() {
  await requireUser(["admin"]);
  const quotes = await listQuoteRequests();
  return (
    <>
      <PageHeader title="Quote requests" description="Site-priced hardware. Assign to the referring partner, or a partner near the site." />
      <Card>
        {quotes.length === 0 ? (
          <EmptyState title="No quote requests" />
        ) : (
          <Table>
            <thead><tr><Th>Requested</Th><Th>Product</Th><Th>Contact</Th><Th>Details</Th><Th>Status</Th></tr></thead>
            <tbody>
              {quotes.map(({ quote, productName }) => (
                <tr key={quote.id}>
                  <Td className="whitespace-nowrap">{formatDate(quote.createdAt)}</Td>
                  <Td>{productName}{quote.partnerId && <span className="block text-xs text-ink-muted">via partner</span>}</Td>
                  <Td><p>{quote.name}</p><p className="text-xs text-ink-muted">{quote.email} · {quote.phone}</p></Td>
                  <Td className="max-w-xs"><p>{quote.city}</p>{quote.message && <p className="text-xs text-ink-muted">{quote.message}</p>}</Td>
                  <Td>
                    <div className="mb-2"><StatusBadge status={quote.status} /></div>
                    <form action={setQuoteStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="quoteId" value={quote.id} />
                      <label htmlFor={`quote-${quote.id}`} className="sr-only">Status</label>
                      <Select id={`quote-${quote.id}`} name="status" defaultValue={quote.status} className="h-9 w-28">
                        {QUOTE_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                      </Select>
                      <button type="submit" className={buttonStyles({ variant: "secondary", size: "sm" })}>Save</button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
