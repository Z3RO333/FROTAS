import { NextRequest, NextResponse } from "next/server";
import { authenticateApiUser } from "@/lib/api-auth";
import { canAccessManutencao } from "@/lib/rbac";
import { apiError } from "@/lib/api-error";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { createSignedAtividadeImageUrl } from "@/lib/repos/atividades-media";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authentication = await authenticateApiUser();
  if (!authentication.ok) return authentication.response;
  if (!canAccessManutencao(authentication.user.perfil)) {
    return apiError("Acesso negado.", 403, "FORBIDDEN");
  }

  const { id } = await params;
  const atividadeId = Number(id);
  if (!atividadeId || isNaN(atividadeId)) {
    return apiError("ID inválido.", 400, "INVALID_ID");
  }

  const { data, error } = await supabaseManutencao
    .from("atividades_manutencao")
    .select("foto_conclusao_path")
    .eq("id", atividadeId)
    .single();

  if (error || !data) {
    return apiError("Atividade não encontrada.", 404, "NOT_FOUND");
  }

  if (!data.foto_conclusao_path) {
    return apiError("Foto não disponível.", 404, "NO_PHOTO");
  }

  try {
    const url = await createSignedAtividadeImageUrl(data.foto_conclusao_path as string);
    // Redireciona em vez de devolver JSON: o link pode ser um <a> simples, sem
    // JS no meio — window.open() depois de um await cai no bloqueador de pop-up.
    return NextResponse.redirect(url);
  } catch (err) {
    return apiError("Erro ao gerar URL de acesso.", 500, "SIGNED_URL_FAILED", err);
  }
}
