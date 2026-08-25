import { notFound } from "next/navigation";
import { DriverSinistroForm, type SinistroTipo } from "@/components/sinistros/driver-sinistro-form";
import { SocorroForm } from "@/components/sinistros/socorro-form";
import { listFrotasForOperationalForms, setoresDistintos } from "@/lib/repos/frotas";
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

  const [frotas, setoresDisponiveis] = await Promise.all([
    listFrotasForOperationalForms(),
    setoresDistintos(),
  ]);

  if (tipo === "socorro") {
    return (
      <SocorroForm
        user={{ name: user.name, email: user.email }}
        frotas={frotas}
        setoresDisponiveis={setoresDisponiveis}
      />
    );
  }

  return (
    <DriverSinistroForm
      frotas={frotas}
      tipo={tipo as "veiculo" | "casa"}
      userEmail={user.email}
      setoresDisponiveis={setoresDisponiveis}
    />
  );
}
