import type { Role } from "@/domain/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: "dashboard" | "subscriptions" | "orders" | "settings" | "clients" | "earnings" | "bulk" | "resources" | "partners" | "products" | "payouts" | "quotes" | "store";
  /** Match only the exact path (for section roots). */
  exact?: boolean;
}

export const DASHBOARD_NAV: Record<Role, NavItem[]> = {
  client: [
    { href: "/account", label: "Overview", icon: "dashboard", exact: true },
    { href: "/account/subscriptions", label: "Subscriptions", icon: "subscriptions" },
    { href: "/account/orders", label: "Orders & invoices", icon: "orders" },
    { href: "/marketplace", label: "Marketplace", icon: "store" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
  partner: [
    { href: "/partner", label: "Dashboard", icon: "dashboard", exact: true },
    { href: "/partner/clients", label: "Clients & leads", icon: "clients" },
    { href: "/partner/earnings", label: "Earnings", icon: "earnings" },
    { href: "/partner/orders", label: "Bulk ordering", icon: "bulk" },
    { href: "/partner/resources", label: "Training & resources", icon: "resources" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
  admin: [
    { href: "/admin", label: "Overview", icon: "dashboard", exact: true },
    { href: "/admin/partners", label: "Partners", icon: "partners" },
    { href: "/admin/orders", label: "Orders", icon: "orders" },
    { href: "/admin/payouts", label: "Payouts", icon: "payouts" },
    { href: "/admin/products", label: "Catalogue", icon: "products" },
    { href: "/admin/quotes", label: "Quote requests", icon: "quotes" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  client: "Business account",
  partner: "Partner portal",
  admin: "Admin",
};
