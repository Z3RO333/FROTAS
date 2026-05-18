"use client";

import { useRouter } from "next/navigation";

export function CDFilterSelect({
  cds,
  selected,
}: {
  cds: string[];
  selected: string | undefined;
}) {
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const cd = e.target.value;
    const url = cd ? `/frotas/disponibilidades?cd=${encodeURIComponent(cd)}` : "/frotas/disponibilidades";
    router.push(url);
  }

  return (
    <select
      id="cd"
      name="cd"
      value={selected ?? ""}
      onChange={handleChange}
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
    >
      <option value="">Todos os CDs</option>
      {cds.map((cd) => (
        <option key={cd} value={cd}>
          {cd}
        </option>
      ))}
    </select>
  );
}
