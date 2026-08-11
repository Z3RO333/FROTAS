"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/rbac";
import { reportCalendarDate } from "@/lib/report-date";
import {
  getVeiculoParaServico,
  registrarServico,
} from "@/lib/repos/manutencao/servicos";
import { atualizarControleBateria } from "@/lib/repos/manutencao/baterias";
import { enviarFrotaParaManutencao } from "@/lib/services/veiculo-status";

const TrocaBateriaSchema = z.object({
  id_veiculo: z.string().trim().min(1, "Selecione a frota."),
  data_compra: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida."),
  modelo_bateria: z.string().trim().min(2, "Informe o modelo da bateria.").max(120),
  loja: z.string().trim().min(2, "Informe a loja ou fornecedor.").max(160),
  observacoes: z.string().trim().max(1000).optional(),
});

export type RegistrarTrocaBateriaState =
  | { ok: true; mensagem: string; frotaId?: number; frotaLabel?: string; bloqueouFrota?: boolean }
  | { ok: false; error: string };

export async function registrarTrocaBateriaAction(
  _prev: RegistrarTrocaBateriaState,
  formData: FormData
): Promise<RegistrarTrocaBateriaState> {
  try {
    const user = await requireAdminUser();
    const parsed = TrocaBateriaSchema.safeParse({
      id_veiculo: formData.get("id_veiculo"),
      data_compra: formData.get("data_compra"),
      modelo_bateria: formData.get("modelo_bateria"),
      loja: formData.get("loja"),
      observacoes: formData.get("observacoes") || undefined,
    });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    if (parsed.data.data_compra > reportCalendarDate()) {
      return { ok: false, error: "A data da troca não pode estar no futuro." };
    }

    const veiculo = await getVeiculoParaServico(parsed.data.id_veiculo);
    if (!veiculo) return { ok: false, error: "Frota não encontrada ou inativa." };

    const motivo = "Serviço rápido: Troca de bateria";
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
        destino: "OUTRO",
        destino_detalhe: "Troca de bateria",
        usuarioEmail: user.email,
      });
      if (!blocked.ok) return { ok: false, error: blocked.error };
    }

    await atualizarControleBateria({
      frotaNumero: veiculo.codigo_frota,
      equipamento: veiculo.equipamento,
      placa: veiculo.placa,
      setor: veiculo.local,
      dataCompra: parsed.data.data_compra,
      modeloBateria: parsed.data.modelo_bateria,
      loja: parsed.data.loja,
    });

    const detalhes = `Modelo: ${parsed.data.modelo_bateria} · Loja: ${parsed.data.loja}`;
    await registrarServico({
      id_veiculo: veiculo.codigo_frota,
      tipo_servico: "bateria",
      data_servico: parsed.data.data_compra,
      observacoes: parsed.data.observacoes
        ? `${detalhes} · ${parsed.data.observacoes}`
        : detalhes,
      registrado_por_email: user.email,
      registrado_por_nome: user.name,
    });

    revalidatePath("/planejamento");
    revalidatePath("/planejamento/bateria");
    revalidatePath("/planejamento/manutencao");
    revalidatePath("/manutencao");
    revalidatePath("/frotas");
    revalidatePath(`/frotas/${veiculo.id}`);
    revalidatePath("/portaria");

    return {
      ok: true,
      mensagem: "Troca registrada e controle de garantia atualizado.",
      frotaId: veiculo.id,
      frotaLabel: veiculo.codigo_frota,
      bloqueouFrota: true,
    };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Não foi possível registrar a troca da bateria.",
    };
  }
}
