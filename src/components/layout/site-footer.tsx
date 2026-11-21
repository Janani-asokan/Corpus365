import Link from "next/link";
import { config } from "@/lib/config";
import { Logo } from "./logo";

const columns = [
  {
    title: "Marketplace",
    links: [
      { href: "/marketplace?type=app", label: "Business apps" },
      { href: "/marketplace?type=hardware", label: "Hardware" },
      { href: "/cart", label: "Cart" },
    ],
  },
  {
    title: "Partners",
    links: [
      { href: "/partners", label: "Partner programme" },
      { href: "/partners/apply", label: "Apply as a partner" },
      { href: "/legal/partner-agreement", label: "Partner agreement" },
    ],
  },
  {
    title: "Account",
    links: [
      { href: "/login", label: "Sign in" },
      { href: "/signup", label: "Create an account" },
      { href: "/forgot-password", label: "Reset password" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="no-print mt-auto bg-ink text-paper/80">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-3">
          <Logo tone="light" />
          <p className="max-w-xs text-sm">Business software for every business, sold and supported by people near you.</p>
          <p className="text-sm">
            <a className="hover:text-white" href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="mb-3 font-display text-sm font-semibold text-white">{column.title}</h2>
            <ul className="space-y-2 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="hover:text-white">{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="container-page py-5 text-xs text-paper/60">
          © {new Date().getFullYear()} Corpus365. Prices shown exclude GST unless stated. Partners earn only from software sold and renewed — never from recruiting.
        </p>
      </div>
    </footer>
  );
}
