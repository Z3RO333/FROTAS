import { ClipboardCheck } from "lucide-react";
import { AtividadeForm } from "@/components/manutencao/atividade-form";
import { AtividadesClient } from "@/components/manutencao/atividades-client";
import { PageHeader, SectionHeader } from "@/components/ui/page-header";
import { listAtividades } from "@/lib/repos/atividades-manutencao";
import { listFrotasForOperationalForms } from "@/lib/repos/frotas";
import { listUsuarios } from "@/lib/repos/usuarios";
import { requireManutencaoUser } from "@/lib/rbac";
import { criarAtividadeAction } from "./_actions";

export const dynamic = "force-dynamic";

const LIMIT = 200;

export default async function AtividadesManutencaoPage() {
  await requireManutencaoUser();

  const [frotas, motoristas, atividades] = await Promise.all([
    listFrotasForOperationalForms(),
    listUsuarios({ perfil: "MOTORISTA_INTERNO", ativo: "ativos" }),
    listAtividades({ limit: LIMIT }),
  ]);

  const vehicles = frotas.map((frota) => ({
    id: frota.id,
    codigo: frota.frota_geral,
    placa: frota.placa,
    modelo: frota.modelo,
    localizacao: frota.localizacao,
    ativo: frota.ativo,
    vendido: frota.vendido,
  }));

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Manutenção"
        title="Atividades"
        icon={ClipboardCheck}
        severity="INFO"
      />

      <section className="rounded-md border bg-white p-4 shadow-sm sm:p-5">
        <SectionHeader title="Nova atividade" />
        <div className="mt-4">
          <AtividadeForm
            vehicles={vehicles}
            motoristas={motoristas.map((m) => ({ id: m.id, nome: m.nome ?? m.email }))}
            action={criarAtividadeAction}
          />
        </div>
      </section>

      <AtividadesClient atividades={atividades} limit={LIMIT} />
    </div>
  );
}
