// app/api/checklists/analyze/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeChecklist } from "@/lib/ai/checklist-analyzer";
import { listChecklistItems } from "@/lib/repos/checklists";
import {
  claimChecklistsPendentesAnalise,
  saveAnaliseIa,
  saveLogIa,
  setAnaliseStatus,
} from "@/lib/repos/analises-ia";
import { createAlerta } from "@/lib/repos/alertas";
import { supabaseManutencao } from "@/lib/supabase-manutencao";

import { isInternalAuthorized } from "@/lib/internal-auth";
import { apiError } from "@/lib/api-error";

// GET /api/checklists/analyze — processa batch de pendentes
export async function GET(req: NextRequest) {
  if (!isInternalAuthorized(req)) return apiError("Unauthorized", 401, "INVALID_INTERNAL_TOKEN");

  const pendentes = await claimChecklistsPendentesAnalise(20);
  const results: Array<{ checklist_id: number; status: string }> = [];

  for (const checklist of pendentes) {
    const res = await processarChecklist(checklist.id);
    results.push({ checklist_id: checklist.id, status: res });
  }

  return NextResponse.json({ processados: results.length, results });
}

// POST /api/checklists/analyze — analisa um checklist específico
export async function POST(req: NextRequest) {
  if (!isInternalAuthorized(req)) return apiError("Unauthorized", 401, "INVALID_INTERNAL_TOKEN");

  const body = await req.json().catch(() => ({}));
  const parsed = z.object({ checklist_id: z.number().int().positive() }).safeParse(body);
  if (!parsed.success) return apiError("checklist_id inválido", 400, "INVALID_CHECKLIST_ID");

  const claimed = await claimChecklistsPendentesAnalise(1, parsed.data.checklist_id);
  if (claimed.length === 0) {
    return NextResponse.json({ checklist_id: parsed.data.checklist_id, status: "nao_pendente" });
  }
  const status = await processarChecklist(parsed.data.checklist_id);
  return NextResponse.json({ checklist_id: parsed.data.checklist_id, status });
}

async function processarChecklist(checklistId: number): Promise<string> {
  try {
    const { data: checklistRows, error: clError } = await supabaseManutencao
      .from("checklists_frota")
      .select("id,frota_id,motorista_id,data_checklist,observacao_original,km_informado,status_geral")
      .eq("id", checklistId)
      .single();

    if (clError || !checklistRows) {
      await setAnaliseStatus(checklistId, "ERRO");
      return "nao_encontrado";
    }

    const cl = checklistRows as {
      id: number; frota_id: number; motorista_id: string; data_checklist: string;
      observacao_original: string | null; km_informado: number | null; status_geral: string;
    };

    const [itens, veiculoResult, kmResult] = await Promise.all([
      listChecklistItems(checklistId),
      supabaseManutencao.from("veiculos").select("codigo_frota,placa,modelo,km_atual").eq("id", cl.frota_id).single(),
      supabaseManutencao
        .from("historico_km_frota")
        .select("km_anterior")
        .eq("frota_id", cl.frota_id)
        .eq("checklist_id", checklistId)
        .maybeSingle(),
    ]);

    const v = veiculoResult.data as { codigo_frota: string | null; placa: string | null; modelo: string | null; km_atual: number | null } | null;
    const kmAnterior = (kmResult.data as { km_anterior: number | null } | null)?.km_anterior ?? null;

    const output = await analyzeChecklist({
      checklist_id: checklistId,
      frota_codigo: v?.codigo_frota ?? null,
      placa: v?.placa ?? null,
      modelo: v?.modelo ?? null,
      km_informado: cl.km_informado,
      km_anterior: kmAnterior,
      status_geral: cl.status_geral,
      observacao_original: cl.observacao_original,
      itens: itens.map((i) => ({
        nome: i.item_nome,
        grupo: i.grupo,
        status: i.status,
        critico: i.critico,
        observacao: i.observacao,
      })),
    });

    await saveLogIa({
      operacao: "analise_checklist",
      checklist_id: checklistId,
      frota_id: cl.frota_id,
      modelo: output.modelo,
      tokens_entrada: output.tokens_entrada,
      tokens_saida: output.tokens_saida,
      duracao_ms: output.duracao_ms,
      sucesso: output.erro === null,
      erro_msg: output.erro,
      payload_entrada: { checklist_id: checklistId },
      payload_saida: output.result,
    });

    if (output.erro !== null || !output.result) {
      await setAnaliseStatus(checklistId, "ERRO");
      return "erro_ia";
    }

    const analiseId = await saveAnaliseIa({
      checklist_id: checklistId,
      frota_id: cl.frota_id,
      motorista_id: cl.motorista_id,
      data_checklist: cl.data_checklist,
      texto_original: cl.observacao_original,
      result: output.result,
      modelo_ia: output.modelo,
    });

    if (
      output.result.criticidade === "CRITICO" ||
      output.result.criticidade === "BLOQUEIO_SUGERIDO" ||
      output.result.manutencao_sugerida
    ) {
      const tipo = output.result.criticidade === "BLOQUEIO_SUGERIDO"
        ? "BLOQUEIO_SUGERIDO"
        : output.result.manutencao_sugerida
          ? "MANUTENCAO"
          : "CRITICO";

      const { count: alertaExistente } = await supabaseManutencao
        .from("alertas_frota")
        .select("id", { count: "exact", head: true })
        .eq("checklist_id", checklistId)
        .eq("status", "ABERTO");

      if ((alertaExistente ?? 0) === 0) {
        await createAlerta({
          frota_id: cl.frota_id,
          checklist_id: checklistId,
          analise_id: analiseId,
          tipo,
          titulo: `${tipo.replace("_", " ")} — Frota ${v?.codigo_frota ?? cl.frota_id}`,
          descricao: output.result.resumo,
        }).catch((err) => console.warn("[alertas] falha ao criar alerta", err));
      }
    }

    await setAnaliseStatus(checklistId, "CONCLUIDA");
    return "ok";
  } catch (err) {
    await setAnaliseStatus(checklistId, "ERRO").catch(() => null);
    console.error("[analyze] erro ao processar checklist", checklistId, err);
    return "erro";
  }
}
