import { NextRequest, NextResponse } from "next/server";
import { authenticateApiUser } from "@/lib/api-auth";
import { canAccessAdmin } from "@/lib/rbac";
import { apiError } from "@/lib/api-error";
import type { ChecklistStatusGeral } from "@/lib/checklists/catalog";
import { buildChecklistsExportWorkbook, checklistsExportFilename } from "@/lib/checklists/export";
import {
  CHECKLIST_EXPORT_MAX_ROWS,
  listChecklistItemsByChecklistIds,
  listChecklistsForExport,
  type ChecklistListFilters,
} from "@/lib/repos/checklists";

export const runtime = "nodejs";

const STATUS_VALUES: ChecklistStatusGeral[] = ["APROVADO", "COM_OBSERVACAO", "NAO_APTO", "CRITICO"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  // Mesma tela de origem (/checklists) já exige requireAdminUser — a API repete
  // a checagem porque é um link direto (download), não passa pelo layout do app.
  const authentication = await authenticateApiUser();
  if (!authentication.ok) return authentication.response;
  if (!canAccessAdmin(authentication.user.perfil)) {
    return apiError("Acesso negado.", 403, "FORBIDDEN");
  }

  const { searchParams } = new URL(request.url);
  const dataInicioRaw = searchParams.get("dataInicio")?.trim() || undefined;
  const dataFimRaw = searchParams.get("dataFim")?.trim() || undefined;
  if (dataInicioRaw && !DATE_RE.test(dataInicioRaw)) {
    return apiError("Data inicial inválida.", 400, "INVALID_DATA_INICIO");
  }
  if (dataFimRaw && !DATE_RE.test(dataFimRaw)) {
    return apiError("Data final inválida.", 400, "INVALID_DATA_FIM");
  }

  const statusRaw = searchParams.get("status")?.trim().toUpperCase();
  const status = STATUS_VALUES.includes(statusRaw as ChecklistStatusGeral)
    ? (statusRaw as ChecklistStatusGeral)
    : undefined;

  const filters: ChecklistListFilters = {
    dataInicio: dataInicioRaw,
    dataFim: dataFimRaw ?? dataInicioRaw,
    veiculo: searchParams.get("veiculo")?.trim() || undefined,
    localizacao: searchParams.get("localizacao")?.trim() || undefined,
    setor: searchParams.get("setor")?.trim() || undefined,
    status,
  };

  try {
    const checklists = await listChecklistsForExport(filters);
    if (checklists.length === 0) {
      return apiError(
        "Nenhum checklist encontrado no intervalo selecionado.",
        404,
        "NO_CHECKLISTS_IN_RANGE"
      );
    }
    if (checklists.length > CHECKLIST_EXPORT_MAX_ROWS) {
      return apiError(
        `O intervalo selecionado tem mais de ${CHECKLIST_EXPORT_MAX_ROWS.toLocaleString("pt-BR")} checklists. Reduza o período e tente novamente.`,
        413,
        "EXPORT_TOO_LARGE"
      );
    }

    const itemsByChecklist = await listChecklistItemsByChecklistIds(checklists.map((c) => c.id));
    const buffer = buildChecklistsExportWorkbook(checklists, itemsByChecklist);
    const filename = checklistsExportFilename(filters.dataInicio, filters.dataFim);

    // Buffer.buffer é tipado como ArrayBufferLike (inclui SharedArrayBuffer),
    // e o BodyInit do fetch/Response só aceita ArrayBuffer — Uint8Array.from
    // copia para um ArrayBuffer novo e resolve a incompatibilidade de tipos.
    return new NextResponse(new Blob([Uint8Array.from(buffer)]), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error) {
    return apiError("Falha ao gerar a exportação de checklists.", 500, "CHECKLIST_EXPORT_FAILED", error);
  }
}
