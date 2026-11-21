import { NextResponse, type NextRequest } from "next/server";
import { findApprovedPartnerByCode } from "@/server/services/partner.service";
import { getProductBySlug } from "@/server/services/catalog.service";
import { PROGRAM } from "@/domain/program";
import { COOKIE, config } from "@/lib/config";

/**
 * Partner referral link: /r/CODE or /r/CODE?to=product-slug.
 * Remembers the partner for a while so their client is credited at sign-up or
 * checkout, then sends the visitor to the product (or the marketplace).
 */
export function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  return params.then(async ({ code }) => {
    const to = request.nextUrl.searchParams.get("to");
    const product = to ? await getProductBySlug(to) : null;
    const destination = new URL(product ? `/marketplace/${product.slug}` : "/marketplace", request.url);
    const response = NextResponse.redirect(destination);

    const partner = await findApprovedPartnerByCode(code);
    if (partner) {
      response.cookies.set(COOKIE.referral, partner.code, {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProduction,
        path: "/",
        maxAge: PROGRAM.referralCookieDays * 86_400,
      });
    }
    return response;
  });
}
