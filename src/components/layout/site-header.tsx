import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCurrentUser, HOME_FOR_ROLE } from "@/server/auth/guards";
import { readCartLines } from "@/server/cart";
import { logoutAction } from "@/server/actions/auth.actions";
import { LinkButton, buttonStyles } from "@/components/ui/button";
import { Logo } from "./logo";
import { MobileMenu } from "./mobile-menu";

const NAV = [
  { href: "/marketplace?type=app", label: "Apps" },
  { href: "/marketplace?type=hardware", label: "Hardware" },
  { href: "/partners", label: "Become a partner" },
];

export async function SiteHeader() {
  const [user, cartLines] = await Promise.all([getCurrentUser(), readCartLines()]);
  const cartCount = cartLines.reduce((n, l) => n + l.quantity, 0);

  const mobileLinks = [
    { href: "/marketplace", label: "Marketplace" },
    ...NAV,
    ...(user
      ? [{ href: HOME_FOR_ROLE[user.role], label: "My dashboard" }]
      : [{ href: "/login", label: "Sign in" }, { href: "/signup", label: "Create a business account" }]),
  ];

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur supports-[backdrop-filter]:bg-paper/75">
      <div className="container-page relative flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Logo />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink-soft hover:bg-ink/5 hover:text-ink">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <Link href="/cart" className="relative grid size-10 place-items-center rounded-lg hover:bg-ink/5" aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}>
            <ShoppingCart className="size-5" aria-hidden />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-ink">
                {cartCount}
              </span>
            )}
          </Link>

          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <>
                <LinkButton href={HOME_FOR_ROLE[user.role]} variant="secondary" size="sm">
                  {user.role === "partner" ? "Partner portal" : user.role === "admin" ? "Admin" : "My account"}
                </LinkButton>
                <form action={logoutAction}>
                  <button type="submit" className={buttonStyles({ variant: "ghost", size: "sm" })}>
                    Sign out
                  </button>
                </form>
              </>
            ) : (
              <>
                <LinkButton href="/login" variant="ghost" size="sm">
                  Sign in
                </LinkButton>
                <LinkButton href="/signup" size="sm">
                  Get started
                </LinkButton>
              </>
            )}
          </div>
          <MobileMenu links={mobileLinks} />
        </div>
      </div>
    </header>
  );
}
