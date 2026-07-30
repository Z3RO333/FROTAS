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
        "relative shrink-0 border-b text-white transition-[width] duration-200 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:border-slate-900/60",
        "bg-[linear-gradient(180deg,#0b1220_0%,#070d18_60%,#050913_100%)]",
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
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 ring-1 ring-inset ring-white/10">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-[11px] font-semibold tracking-wide text-slate-200">{perfil}</span>
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
                    "group mb-1 hidden w-full items-center justify-between rounded-md px-2 py-1 text-left transition-colors hover:bg-white/[0.03] lg:flex",
                    collapsed && "lg:hidden"
                  )}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 transition-colors group-hover:text-slate-400">
                    {section.title}
                  </span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 text-slate-600 transition-transform duration-150 group-hover:text-slate-400",
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
                <div
                  className={cn(
                    "my-2.5 hidden h-px lg:block",
                    "bg-gradient-to-r from-transparent via-white/[0.08] to-transparent",
                    collapsed && "mx-0"
                  )}
                />
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
        "group relative flex h-9 shrink-0 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-400 transition-all duration-150 lg:w-full",
        "hover:bg-white/[0.06] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]",
        active &&
          "bg-gradient-to-r from-blue-500/20 via-blue-500/10 to-transparent text-white shadow-[inset_0_0_0_1px_rgba(96,165,250,0.18)]",
        collapsed && "lg:justify-center lg:px-0 lg:w-10 lg:h-10"
      )}
    >
      {/* Barra esquerda azul no item ativo */}
      <span
        className={cn(
          "pointer-events-none absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full transition-all duration-150",
          active
            ? "bg-gradient-to-b from-blue-400 to-sky-500 opacity-100 shadow-[0_0_8px_rgba(96,165,250,0.65)]"
            : "opacity-0"
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-all duration-150",
          active
            ? "bg-blue-500/15 text-blue-300 ring-1 ring-inset ring-blue-400/20"
            : "text-slate-500 group-hover:text-slate-200"
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
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
