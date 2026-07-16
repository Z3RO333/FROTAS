import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PagePagination({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (page: number) => string;
}) {
  if (totalPages <= 1) return null;
  const candidates = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
  const pages = [...candidates].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);

  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
        {page > 1 ? <Link href={href(page - 1)}><ChevronLeft className="h-4 w-4" />Anterior</Link> : <span><ChevronLeft className="h-4 w-4" />Anterior</span>}
      </Button>
      {pages.map((value, index) => (
        <span key={value} className="contents">
          {index > 0 && value - pages[index - 1] > 1 ? <span aria-hidden="true">…</span> : null}
          <Button variant={value === page ? "default" : "outline"} size="sm" asChild>
            <Link href={href(value)} aria-current={value === page ? "page" : undefined}>{value}</Link>
          </Button>
        </span>
      ))}
      <Button variant="outline" size="sm" asChild={page < totalPages} disabled={page >= totalPages}>
        {page < totalPages ? <Link href={href(page + 1)}>Próxima<ChevronRight className="h-4 w-4" /></Link> : <span>Próxima<ChevronRight className="h-4 w-4" /></span>}
      </Button>
    </nav>
  );
}
