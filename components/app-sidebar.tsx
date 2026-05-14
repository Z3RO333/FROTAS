"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Gauge,
  Home,
  LayoutDashboard,
  List,
  MapPin,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PerfilUsuario } from "@/lib/rbac";

const NAV_ICONS = {
  AlertTriangle,
  BarChart2,
  Building2,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Gauge,
  Home,
  LayoutDashboard,
  List,
  MapPin,
  Settings,
  ShieldAlert,
  ShoppingCart,
  Truck,
  Users,
  Wrench,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export function AppSidebar({
  sections,
  perfil,
}: {
  sections: NavSection[];
  perfil: PerfilUsuario;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const activeHref = findActiveHref(pathname, sections);

  return (
    <aside
      className={cn(
        "border-b bg-slate-950 text-white transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-900",
        collapsed ? "lg:w-[84px]" : "lg:w-[280px]"
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className={cn("border-b border-white/10 px-5 py-5", collapsed && "lg:px-3")}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/15 ring-1 ring-blue-300/20">
              <Truck className="h-5 w-5 text-blue-100" aria-hidden="true" />
            </div>
            <div className={cn("min-w-0", collapsed && "lg:hidden")}>
              <div className="text-sm font-semibold tracking-wide">FROTAS</div>
              <div className="truncate text-xs text-slate-400">Plataforma operacional</div>
            </div>
          </div>

          <div className={cn("mt-4 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2", collapsed && "lg:hidden")}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Perfil</div>
            <div className="mt-1 text-sm font-medium text-white">{perfil}</div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-4 hidden h-9 w-9 border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white lg:inline-flex"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav
          className={cn(
            "flex gap-2 overflow-x-auto px-3 py-3 lg:block lg:min-h-0 lg:flex-1 lg:space-y-5 lg:overflow-x-hidden lg:overflow-y-auto lg:px-4 lg:py-5",
            collapsed && "lg:px-3"
          )}
        >
          {sections.map((section) => (
            <div key={section.title} className="min-w-max lg:min-w-0">
              <div
                className={cn(
                  "mb-2 hidden px-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 lg:block",
                  collapsed && "lg:sr-only"
                )}
              >
                {section.title}
              </div>
              <div className="flex gap-1 lg:block lg:space-y-1">
                {section.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={item.href === activeHref}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = NAV_ICONS[item.icon];

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      className={cn(
        "flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white lg:w-full",
        active && "bg-blue-500/15 text-white ring-1 ring-blue-300/15",
        collapsed && "lg:justify-center lg:px-0"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0 text-slate-400", active && "text-blue-100")} aria-hidden="true" />
      <span className={cn("whitespace-nowrap", collapsed && "lg:sr-only")}>{item.label}</span>
    </Link>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(pathname: string, sections: NavSection[]): string | null {
  const items = sections.flatMap((section) => section.items);
  return items
    .filter((item) => isActivePath(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}
