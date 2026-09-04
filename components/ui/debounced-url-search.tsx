"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { withQuery } from "@/lib/navigation/search-state";

type DebouncedUrlSearchProps = {
  paramName?: string;
  defaultValue?: string;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  inputClassName?: string;
  delay?: number;
};

export function DebouncedUrlSearch({
  paramName = "q",
  defaultValue = "",
  placeholder = "Buscar...",
  ariaLabel = "Pesquisar",
  className,
  inputClassName,
  delay = 350,
}: DebouncedUrlSearchProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const [isPending, startTransition] = useTransition();

  useEffect(() => setValue(defaultValue), [defaultValue]);

  const apply = useCallback(
    (nextValue: string) => {
      const url = withQuery(pathname, searchParams, {
        [paramName]: nextValue.trim() || null,
        page: null,
      });
      startTransition(() => router.replace(url, { scroll: false }));
    },
    [paramName, pathname, router, searchParams]
  );

  useEffect(() => {
    const current = searchParams.get(paramName) ?? "";
    if (value.trim() === current) return;
    const timer = window.setTimeout(() => apply(value), delay);
    return () => window.clearTimeout(timer);
  }, [apply, delay, paramName, searchParams, value]);

  return (
    <div className={cn("relative min-w-0 flex-1", className)} aria-busy={isPending}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        className={cn("pl-9 pr-9", inputClassName)}
      />
      {isPending ? (
        <Loader2
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-600"
          aria-label="Atualizando resultados"
        />
      ) : value ? (
        <button
          type="button"
          onClick={() => {
            setValue("");
            apply("");
          }}
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Limpar pesquisa"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
