import { NextResponse, type NextRequest } from "next/server";
import { COOKIE } from "@/lib/config";

const PROTECTED_PREFIXES = ["/account", "/partner", "/admin", "/settings", "/checkout", "/invoices"];

/**
 * Fast, optimistic gate: bounces visitors without a session cookie to sign-in.
 * Real authorisation (valid session, correct role) is enforced on the server in
 * layouts, pages and actions via `requireUser`.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !request.cookies.has(COOKIE.session)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
