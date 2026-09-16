"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const PAGE_SIZE_OPTIONS = [50, 100, 150, 200] as const;

export function PageSizeSelect({ basePath = "/checklists", value }: { basePath?: string; value: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("pageSize", next);
    params.delete("page");
    startTransition(() => {
      router.replace(`${basePath}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <Select value={String(value)} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger aria-label="Linhas por página" className="h-8 w-[104px] text-xs">
        <SelectValue>{value} linhas</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PAGE_SIZE_OPTIONS.map((size) => (
          <SelectItem key={size} value={String(size)}>
            {size} linhas
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
