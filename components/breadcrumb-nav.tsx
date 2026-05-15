"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string };
type NavSection = { title: string; items: NavItem[] };

export function BreadcrumbNav({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  const allItems = sections.flatMap((s) =>
    s.items.map((item) => ({ ...item, section: s.title }))
  );

  const active = allItems
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
    )
    .sort((a, b) => b.href.length - a.href.length)[0];

  if (!active) {
    return (
      <span className="text-sm text-muted-foreground">
        {pathname.split("/").filter(Boolean).join(" / ") || "Início"}
      </span>
    );
  }

  const isRoot = active.href === "/";

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {!isRoot && (
        <>
          <Link
            href="/"
            className="text-muted-foreground/60 transition-colors hover:text-muted-foreground"
            aria-label="Início"
          >
            <Home className="h-3.5 w-3.5" />
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
          <span className="text-muted-foreground/70">{active.section}</span>
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
        </>
      )}
      <span className={cn("font-medium text-foreground", isRoot && "text-muted-foreground")}>
        {active.label}
      </span>
    </nav>
  );
}
