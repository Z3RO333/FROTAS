import { requireAppUser, canAccessManutencao } from "@/lib/rbac";
import { listOficinas } from "@/lib/repos/manutencao/oficinas";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
import type { OficinasApp } from "@/lib/repos/manutencao/types";

export const dynamic = "force-dynamic";

export default async function OficinasPage() {
  const user = await requireAppUser();
  if (!canAccessManutencao(user.perfil)) redirect("/");

  const oficinas = await listOficinas();

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">Manutenção</p>
        <h1 className="text-3xl font-semibold tracking-tight">Oficinas</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {oficinas.map((o) => (
          <OficinaCard key={o.id} oficina={o} />
        ))}
        {oficinas.length === 0 && (
          <p className="col-span-full py-8 text-center text-muted-foreground">
            Nenhuma oficina cadastrada.
          </p>
        )}
      </div>
    </div>
  );
}

function OficinaCard({ oficina }: { oficina: OficinasApp }) {
  const gmapsUrl =
    oficina.localizacao_lat && oficina.localizacao_lng
      ? `https://maps.google.com/?q=${oficina.localizacao_lat},${oficina.localizacao_lng}`
      : `https://maps.google.com/?q=${encodeURIComponent(oficina.localizacao)}`;

  return (
    <article className="space-y-3 rounded-md border bg-white p-4 shadow-sm">
      <div>
        <h2 className="font-semibold">{oficina.nome}</h2>
        <p className="text-sm text-muted-foreground">{oficina.categoria}</p>
      </div>
      <a
        href={gmapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-sm text-blue-700 hover:underline"
      >
        <MapPin className="h-3 w-3" />
        {oficina.localizacao}
      </a>
      {oficina.tipos_servico.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {oficina.tipos_servico.map((t) => (
            <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
          ))}
        </div>
      )}
    </article>
  );
}
