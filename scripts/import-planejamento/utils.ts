import { createHash } from "node:crypto";

export function excelDateToIso(serial: unknown): string | null {
  if (serial == null || serial === "" || serial === "-") return null;
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1) return null;
  const ms = Math.round((n - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function normPlaca(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/[\s\-]/g, "").toUpperCase();
  return s.length > 3 ? s : null;
}

export function normStatus(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase().replace(/\s+/g, "_");
  if (s === "" || s === "-" || s === "N/A") return null;
  return s;
}

export function nullify(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s === "-" || s === "N/A" || s === "#N/D" || s === "#REF!") return null;
  return s;
}

export function asInt(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : Number.isFinite(n) ? Math.round(n) : null;
}

export function asNum(v: unknown): number | null {
  if (v == null || v === "" || v === "-") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function hashLinha(dados: unknown): string {
  return createHash("sha256").update(JSON.stringify(dados)).digest("hex");
}

export function normEquip(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim().replace(/[^0-9]/g, "");
  return s.length > 0 ? s : null;
}

export function normFrota(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s === "-") return null;
  return s;
}

export function asBool(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  const s = String(v).trim().toUpperCase();
  if (s === "SIM" || s === "TRUE" || s === "1" || s === "S") return true;
  if (s === "NÃO" || s === "NAO" || s === "FALSE" || s === "0" || s === "N") return false;
  const n = Number(v);
  if (Number.isFinite(n) && n > 40000) return true;
  return null;
}
