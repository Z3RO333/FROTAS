import { ReparoFrotaForm } from "@/components/reparos-frota/reparo-frota-form";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { requireReparoFrotaUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function NovoReparoFrotaPage() {
  const user = await requireReparoFrotaUser();
  const frotas = await listFrotasForOperationalForms();

  return <ReparoFrotaForm frotas={frotas} user={{ name: user.name, email: user.email }} />;
}
