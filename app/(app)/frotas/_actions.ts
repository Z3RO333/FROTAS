"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendRelatorioGeral, sendRelatorioIndividual } from "@/lib/email";
import { createFrota, getFrota, listFrotasForReport, softDeleteFrota, updateFrota } from "@/lib/repos/frotas";
import { requireAdminUser } from "@/lib/rbac";

const StatusEnum = z.enum(["disponivel", "manutencao", "atencao", "critico", "vendido"]);

const FrotaSchema = z.object({
  frota_geral: z.string().trim().optional().nullable(),
  placa: z.string().trim().min(1).max(20).optional().nullable(),
  modelo: z.string().trim().min(1).max(100),
  chassi: z.string().trim().min(5).max(40).optional().nullable(),
  renavam: z.string().trim().optional().nullable(),
  ano_fabricacao: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  localizacao: z.string().trim().optional().nullable(),
  km_atual: z.coerce.number().int().min(0).optional().nullable(),
  status: StatusEnum.optional().nullable(),
  observacoes: z.string().trim().optional().nullable(),
});

const ALLOWED_EMAIL_DOMAIN = (process.env.ALLOWED_EMAIL_DOMAIN || "bemol.com.br").toLowerCase();
const MAX_DESTINATARIOS = 10;
const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const EmailListSchema = z
  .string()
  .transform((s) =>
    s
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  )
  .refine((emails) => emails.length > 0, { message: "Informe pelo menos um destinatário." })
  .refine((emails) => emails.length <= MAX_DESTINATARIOS, {
    message: `Máximo de ${MAX_DESTINATARIOS} destinatários por envio.`,
  })
  .refine((emails) => emails.every((e) => EMAIL_REGEX.test(e)), { message: "E-mails inválidos." })
  .refine(
    (emails) => emails.every((e) => e.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)),
    { message: `Apenas destinatários @${ALLOWED_EMAIL_DOMAIN} são permitidos.` }
  );

type RelatorioActionResult = { ok: true } | { ok: false; error: string };

async function requireUser(): Promise<string> {
  const user = await requireAdminUser();
  return user.email;
}

function formObject(formData: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    obj[key] = value === "" ? null : value;
  }
  return obj;
}

function parseDestinatarios(formData: FormData): string[] {
  const raw = formData.get("destinatarios");
  if (typeof raw !== "string") throw new Error("Destinatários obrigatórios");
  return EmailListSchema.parse(raw);
}

function revalidateFrotasCache() {
  updateTag("frotas:filters");
  updateTag("frotas:dashboard");
  revalidatePath("/frotas");
  revalidatePath("/frotas/vendidos");
  revalidatePath("/");
}

function actionErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Dados inválidos.";
  }
  if (error instanceof Error) {
    const publicMessages = new Set([
      "Destinatários obrigatórios",
      "Frota não encontrada",
      "Não autenticado",
    ]);
    if (publicMessages.has(error.message)) return error.message;
  }
  return "Erro inesperado ao enviar relatório.";
}

export async function criarFrotaAction(formData: FormData) {
  const email = await requireUser();
  const parsed = FrotaSchema.parse(formObject(formData));
  const id = await createFrota(parsed, email);
  revalidateFrotasCache();
  redirect(`/frotas/${id}`);
}

export async function editarFrotaAction(id: number, formData: FormData) {
  const email = await requireUser();
  const parsed = FrotaSchema.partial().parse(formObject(formData));
  await updateFrota(id, parsed, email);
  revalidatePath(`/frotas/${id}`);
  revalidateFrotasCache();
  redirect(`/frotas/${id}`);
}

export async function atualizarLocalizacaoFrotaAction(formData: FormData) {
  const email = await requireUser();
  const id = Number(formData.get("id"));
  const localizacaoRaw = formData.get("localizacao");
  const localizacao = typeof localizacaoRaw === "string" && localizacaoRaw.trim() ? localizacaoRaw.trim() : null;

  if (!Number.isFinite(id)) throw new Error("Frota inválida");

  await updateFrota(id, { localizacao }, email);
  revalidatePath(`/frotas/${id}`);
  revalidatePath("/frotas/disponibilidades");
  revalidateFrotasCache();
}

export async function excluirFrotaAction(id: number) {
  const email = await requireUser();
  await softDeleteFrota(id, email);
  revalidateFrotasCache();
  redirect("/frotas");
}

export async function enviarRelatorioGeralAction(formData: FormData): Promise<RelatorioActionResult> {
  try {
    const email = await requireUser();
    const destinatarios = parseDestinatarios(formData);
    const frotas = await listFrotasForReport();
    const result = await sendRelatorioGeral({ destinatarios, frotas, enviadoPor: email });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    console.error("Erro ao enviar relatório geral", error);
    return { ok: false, error: actionErrorMessage(error) };
  }
}

export async function enviarRelatorioIndividualAction(
  frotaId: number,
  formData: FormData
): Promise<RelatorioActionResult> {
  try {
    const email = await requireUser();
    const destinatarios = parseDestinatarios(formData);
    const frota = await getFrota(frotaId);
    if (!frota) throw new Error("Frota não encontrada");
    const result = await sendRelatorioIndividual({ destinatarios, frota, enviadoPor: email });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    console.error(`Erro ao enviar relatório da frota ${frotaId}`, error);
    return { ok: false, error: actionErrorMessage(error) };
  }
}
