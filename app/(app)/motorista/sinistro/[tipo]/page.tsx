import { notFound } from "next/navigation";
import { DriverSinistroForm, type SinistroTipo } from "@/components/sinistros/driver-sinistro-form";
import { SocorroForm } from "@/components/sinistros/socorro-form";
import { listFrotas } from "@/lib/repos/frotas";
import { requireAppUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const TIPOS_VALIDOS = new Set<SinistroTipo>(["veiculo", "casa", "socorro"]);

export default async function ReportarSinistroTipoPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const user = await requireAppUser();
  const { tipo } = await params;
  if (!TIPOS_VALIDOS.has(tipo as SinistroTipo)) notFound();

  if (tipo === "socorro") {
    return <SocorroForm user={{ name: user.name, email: user.email }} />;
  }

  const { rows } = await listFrotas({ pageSize: 200 });
  return <DriverSinistroForm frotas={rows} tipo={tipo as "veiculo" | "casa"} />;
}
