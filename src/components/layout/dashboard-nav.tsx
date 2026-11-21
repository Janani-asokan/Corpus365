"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  FileText,
  Handshake,
  LayoutDashboard,
  Package,
  Receipt,
  RefreshCw,
  Settings,
  Store,
  Users,
  Wallet,
  Inbox,
  Boxes,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/navigation";

const ICONS = {
  dashboard: LayoutDashboard,
  subscriptions: RefreshCw,
  orders: Receipt,
  settings: Settings,
  clients: Users,
  earnings: Wallet,
  bulk: Package,
  resources: BookOpen,
  partners: Handshake,
  products: Boxes,
  payouts: FileText,
  quotes: Inbox,
  store: Store,
} as const;

export function DashboardNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const isActive = (item: NavItem) => (item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <nav aria-label="Dashboard">
      <ul className="relative flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(item);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-ink text-white" : "text-ink-soft hover:bg-ink/5 hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
