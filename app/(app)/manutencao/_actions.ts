"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdminUser } from "@/lib/rbac";
import { getVeiculoParaServico, registrarServico } from "@/lib/repos/manutencao/servicos";
import { reportCalendarDate } from "@/lib/report-date";
import { enviarFrotaParaManutencao, type DestinoManutencao } from "@/lib/services/veiculo-status";
const ServicoSchema = z.object({
  id_veiculo: z.string().min(1),
  tipo_servico: z.enum([
    "troca_pneu", "lavagem", "alinhamento", "balanceamento",
    "tacografo", "portas_rool_up", "embreagem", "motor",
    "km_diario", "ar-condicionado", "suspensao", "bateria",
  ]),
  data_servico: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida."),
  quilometragem: z.coerce.number().int().min(0).optional(),
  observacoes: z.string().trim().max(1000).optional(),
});

const SERVICOS_COM_KM_OBRIGATORIO = new Set([
  "alinhamento",
  "balanceamento",
  "motor",
  "suspensao",
]);

export type RegistrarServicoState =
  | { ok: true; mensagem: string; frotaId?: number; frotaLabel?: string; bloqueouFrota?: boolean }
  | { ok: false; error: string };

const SERVICO_META: Record<string, { label: string; destino: DestinoManutencao }> = {
  lavagem: { label: "Lavagem", destino: "LAVAGEM" },
  alinhamento: { label: "Alinhamento", destino: "ALINHAMENTO" },
  balanceamento: { label: "Balanceamento", destino: "ALINHAMENTO" },
  motor: { label: "Preventiva do motor", destino: "PREVENTIVA" },
  suspensao: { label: "Suspensão", destino: "PREVENTIVA" },
  "ar-condicionado": { label: "Ar-condicionado", destino: "AR_CONDICIONADO" },
  embreagem: { label: "Embreagem", destino: "PREVENTIVA" },
  portas_rool_up: { label: "Porta Roll-Up", destino: "PREVENTIVA" },
  tacografo: { label: "Tacógrafo", destino: "TACOGRAFO" },
};

export async function registrarServicoAction(
  _prev: RegistrarServicoState,
  formData: FormData
): Promise<RegistrarServicoState> {
  try {
    const user = await requireAdminUser();

    const raw = {
      id_veiculo: formData.get("id_veiculo"),
      tipo_servico: formData.get("tipo_servico"),
      data_servico: formData.get("data_servico"),
      quilometragem: formData.get("quilometragem") || undefined,
      observacoes: formData.get("observacoes") || undefined,
    };
    const parsed = ServicoSchema.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    if (parsed.data.data_servico > reportCalendarDate()) {
      return { ok: false, error: "A data realizada não pode estar no futuro." };
    }
    if (SERVICOS_COM_KM_OBRIGATORIO.has(parsed.data.tipo_servico) && parsed.data.quilometragem == null) {
      return { ok: false, error: "Informe a quilometragem para calcular o próximo serviço." };
    }

    const meta = SERVICO_META[parsed.data.tipo_servico];
    if (!meta) return { ok: false, error: "Este serviço deve ser registrado pelo fluxo específico dele." };

    const veiculo = await getVeiculoParaServico(parsed.data.id_veiculo);
    if (!veiculo) return { ok: false, error: "Frota não encontrada ou inativa." };

    const motivo = `Serviço rápido: ${meta.label}`;
    const alreadyBlockedByThisService =
      veiculo.status === "manutencao" && veiculo.manutencao_motivo === motivo;

    if (veiculo.status === "manutencao" && !alreadyBlockedByThisService) {
      return { ok: false, error: "A frota já está bloqueada por outra manutenção." };
    }

    if (!alreadyBlockedByThisService) {
      const blocked = await enviarFrotaParaManutencao({
        frotaId: veiculo.id,
        motivo,
        tipo: "PREVENTIVA",
        prevRetorno: reportCalendarDate(),
        observacao: parsed.data.observacoes ?? null,
        bloqueiaChecklist: true,
        destino: meta.destino,
        usuarioEmail: user.email,
      });
      if (!blocked.ok) return { ok: false, error: blocked.error };
    }

    await registrarServico({
      ...parsed.data,
      registrado_por_email: user.email,
      registrado_por_nome: user.name,
    });

    revalidatePath("/manutencao");
    revalidatePath("/planejamento");
    revalidatePath("/planejamento/lavagem");
    revalidatePath("/planejamento/manutencao");
    revalidatePath("/frotas");
    revalidatePath(`/frotas/${veiculo.id}`);
    revalidatePath("/portaria");
    return {
      ok: true,
      mensagem: `${meta.label} registrada. A frota foi bloqueada para manutenção.`,
      frotaId: veiculo.id,
      frotaLabel: veiculo.codigo_frota,
      bloqueouFrota: true,
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível registrar o serviço.",
    };
  }
}
