import { notFound } from "next/navigation";
import { DriverSinistroForm, type SinistroTipo } from "@/components/sinistros/driver-sinistro-form";
import { listFrotas } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const TIPOS_VALIDOS = new Set<SinistroTipo>(["veiculo", "casa"]);

export default async function ReportarSinistroTipoPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  await requireAppUser();
  const { tipo } = await params;
  if (!TIPOS_VALIDOS.has(tipo as SinistroTipo)) notFound();

  const { rows } = await listFrotas({ pageSize: 200 });
  return <DriverSinistroForm frotas={rows} tipo={tipo as SinistroTipo} />;
}
