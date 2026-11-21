import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/server/auth/guards";
import { listProducts, startingPrice } from "@/server/services/catalog.service";
import { setProductStatusAction } from "@/server/actions/admin.actions";
import { PRODUCT_STATUSES } from "@/domain/constants";
import { bpsToPercent } from "@/domain/money";
import { formatMoney, humanize } from "@/lib/format";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th } from "@/components/ui/table";
import { Select } from "@/components/ui/field";
import { buttonStyles } from "@/components/ui/button";
import { ProductIcon } from "@/components/ui/product-icon";

export const metadata: Metadata = { title: "Catalogue" };

export default async function AdminProductsPage() {
  await requireUser(["admin"]);
  const products = listProducts();
  return (
    <>
      <PageHeader title="Catalogue" description="Control what clients can buy. Placeholder prices until suppliers are confirmed." />
      <Card>
        <Table>
          <thead><tr><Th>Product</Th><Th>Type</Th><Th>From</Th><Th>Partner margin</Th><Th>Status</Th><Th>Change status</Th></tr></thead>
          <tbody>
            {products.map((product) => {
              const price = startingPrice(product);
              return (
                <tr key={product.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <ProductIcon icon={product.icon} type={product.type} size="sm" />
                      <Link href={`/marketplace/${product.slug}`} className="font-medium hover:text-brand">{product.name}</Link>
                    </div>
                  </Td>
                  <Td>{humanize(product.type)} · {product.category}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{price ? `${formatMoney(price.amount)}${product.type === "app" ? `/${price.interval}` : ""}` : "—"}</Td>
                  <Td>{product.type === "hardware" && product.hardwareMargin ? bpsToPercent(product.hardwareMargin) : "Tier rate"}</Td>
                  <Td><StatusBadge status={product.status} /></Td>
                  <Td>
                    <form action={setProductStatusAction} className="flex items-center gap-2">
                      <input type="hidden" name="productId" value={product.id} />
                      <label htmlFor={`status-${product.id}`} className="sr-only">Status for {product.name}</label>
                      <Select id={`status-${product.id}`} name="status" defaultValue={product.status} className="h-9 w-36">
                        {PRODUCT_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
                      </Select>
                      <button type="submit" className={buttonStyles({ variant: "secondary", size: "sm" })}>Save</button>
                    </form>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
