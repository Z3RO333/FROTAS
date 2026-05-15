"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AlertTriangle,
  BarChart2,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  DoorOpen,
  FileText,
  Gauge,
  History,
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
  History,
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
  // Seções abertas no desktop (todas abertas por padrão)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(
    () => Object.fromEntries(sections.map((s) => [s.title, true]))
  );
  const activeHref = findActiveHref(pathname, sections);

  function toggleSection(title: string) {
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));
  }

  return (
    <aside
      className={cn(
        "border-b bg-slate-950 text-white transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-900",
        collapsed ? "lg:w-[64px]" : "lg:w-[264px]"
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Banner do caminhão Bemol */}
        <div className={cn("relative border-b border-white/10", collapsed && "lg:hidden")}>
          <div className="relative h-[130px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/bemol-truck.jpg"
              alt="Caminhão Bemol"
              className="absolute inset-0 h-full w-full object-cover object-[50%_75%]"
            />
            {/* Gradient escuro suave na parte inferior para o texto */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />
            {/* Gradient lateral esquerdo muito sutil */}
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/30 to-transparent" />

            {/* Texto sobre o gradient */}
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
              <div className="text-sm font-bold tracking-wide text-white">FROTAS BEMOL</div>
              <div className="text-[10px] text-slate-400">Plataforma operacional</div>
            </div>

            {/* Botão colapsar no canto superior direito */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 hidden h-6 w-6 bg-black/30 text-slate-300 hover:bg-black/50 hover:text-white lg:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Recolher menu lateral"
              title="Recolher"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
          </div>

          {/* Badge de perfil abaixo da imagem */}
          <div className="flex items-center justify-between px-4 py-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-slate-300">{perfil}</span>
            </div>
          </div>
        </div>

        {/* Logo compacto quando collapsed */}
        <div className={cn("hidden border-b border-white/10 px-2 py-3", collapsed && "lg:block")}>
          <div className="flex flex-col items-center gap-2">
            <div className="relative h-10 w-10 overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/bemol-truck.jpg"
                alt="Bemol"
                className="absolute inset-0 h-full w-full object-cover object-[30%_60%]"
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Expandir menu lateral"
              title="Expandir"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Nav */}
        <nav
          className={cn(
            "flex gap-2 overflow-x-auto px-2 py-3 lg:block lg:min-h-0 lg:flex-1 lg:space-y-1 lg:overflow-x-hidden lg:overflow-y-auto lg:px-3 lg:py-4",
            collapsed && "lg:px-2"
          )}
        >
          {sections.map((section) => {
            const isOpen = openSections[section.title] !== false;
            return (
              <div key={section.title} className="min-w-max lg:min-w-0">
                {/* Título da seção — clicável para colapsar */}
                <button
                  type="button"
                  onClick={() => toggleSection(section.title)}
                  className={cn(
                    "mb-1 hidden w-full items-center justify-between rounded-md px-2 py-1 text-left lg:flex",
                    collapsed && "lg:hidden"
                  )}
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    {section.title}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-slate-600 transition-transform duration-150",
                      !isOpen && "-rotate-90"
                    )}
                  />
                </button>

                {/* Items da seção */}
                <div
                  className={cn(
                    "flex gap-1 overflow-hidden transition-all duration-200 lg:block lg:space-y-0.5",
                    !isOpen && "lg:hidden"
                  )}
                >
                  {section.items.map((item) => (
                    <SidebarLink
                      key={item.href}
                      item={item}
                      active={item.href === activeHref}
                      collapsed={collapsed}
                    />
                  ))}
                </div>

                {/* Separador entre seções */}
                <div className={cn("my-2 hidden border-t border-white/[0.06] lg:block", collapsed && "mx-0")} />
              </div>
            );
          })}
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
      title={item.label}
      aria-label={item.label}
      className={cn(
        "group flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-white/8 hover:text-white lg:w-full",
        active && "bg-blue-500/15 text-white ring-1 ring-inset ring-blue-400/20",
        collapsed && "lg:justify-center lg:px-0 lg:w-10 lg:h-10"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-blue-300" : "text-slate-500 group-hover:text-slate-300"
        )}
        aria-hidden="true"
      />
      <span className={cn("truncate", collapsed && "lg:sr-only")}>{item.label}</span>
    </Link>
  );
}

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function findActiveHref(pathname: string, sections: NavSection[]): string | null {
  const items = sections.flatMap((section) => section.items);
  return (
    items
      .filter((item) => isActivePath(pathname, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null
  );
}
