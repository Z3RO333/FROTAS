import { NextRequest, NextResponse } from "next/server";
import { authenticateApiUser } from "@/lib/api-auth";
import { canAccessManutencao } from "@/lib/rbac";
import { apiError } from "@/lib/api-error";
import { supabaseManutencao } from "@/lib/supabase-manutencao";
import { createSignedAtividadeImageUrl } from "@/lib/repos/atividades-media";

export async function GET(
  request: NextRequest,
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
    .select("foto_conclusao_paths")
    .eq("id", atividadeId)
    .single();

  if (error || !data) {
    return apiError("Atividade não encontrada.", 404, "NOT_FOUND");
  }

  const paths = (data.foto_conclusao_paths ?? []) as string[];
  // ?i=N escolhe qual foto abrir; sem o parâmetro, abre a primeira.
  const indice = Number(request.nextUrl.searchParams.get("i") ?? "0");
  const path = Number.isInteger(indice) ? paths[indice] : undefined;

  if (!path) {
    return apiError("Foto não disponível.", 404, "NO_PHOTO");
  }

  try {
    const url = await createSignedAtividadeImageUrl(path);
    // Redireciona em vez de devolver JSON: o link pode ser um <a> simples, sem
    // JS no meio — window.open() depois de um await cai no bloqueador de pop-up.
    return NextResponse.redirect(url);
  } catch (err) {
    return apiError("Erro ao gerar URL de acesso.", 500, "SIGNED_URL_FAILED", err);
  }
}
