function getPrincipalPart(placa: string | null | undefined): string {
  return String(placa ?? "").toUpperCase().split("/")[0]?.trim() ?? "";
}

export function gerarPrefixoNumeroFogo(placa: string | null | undefined): string {
  const principal = getPrincipalPart(placa);
  if (!principal) return "000";

  const partes = principal
    .split("-")
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (partes.length >= 3 && /\d/.test(partes[0])) {
    const ultimaParte = partes[partes.length - 1] ?? "";
    const digitosFinais = ultimaParte.replace(/[^0-9]/g, "");
    if (digitosFinais.length >= 2) return digitosFinais.slice(-2).padStart(2, "0");
  }

  const letras = principal.replace(/[^A-Z]/g, "");
  if (letras.length >= 3) return letras.slice(0, 3);

  const alfanumerico = principal.replace(/[^A-Z0-9]/g, "");
  if (!alfanumerico) return "000";
  return (alfanumerico + "000").slice(0, 3);
}

export function normalizarFrotaParaNumeroFogo(
  frota: string | number | null | undefined,
  placa: string | null | undefined
): string {
  const frotaBruta = String(frota ?? "").trim();
  if (frotaBruta) {
    const somenteDigitos = frotaBruta.replace(/[^0-9]/g, "");
    if (somenteDigitos) return somenteDigitos.padStart(3, "0");

    const alfanumerico = frotaBruta.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (alfanumerico) {
      const tamanhoMinimo = Math.max(3, alfanumerico.length);
      return (alfanumerico + "000").slice(0, tamanhoMinimo);
    }
  }

  return gerarPrefixoNumeroFogo(placa);
}

export function gerarNumeroFogoSequencial({
  frota,
  placa,
  ano = new Date().getFullYear(),
  contagem = 1,
}: {
  frota?: string | number | null;
  placa?: string | null;
  ano?: number;
  contagem?: number;
}) {
  const digitoAno = String(ano).slice(-1);
  const prefixo = normalizarFrotaParaNumeroFogo(frota, placa) || "000";
  const contagemNumero = Number.isFinite(Number(contagem)) && Number(contagem) > 0 ? Math.floor(Number(contagem)) : 1;
  const contagemFormatada = String(contagemNumero).padStart(2, "0");

  return {
    prefixo,
    contagem: contagemNumero,
    digitoAno,
    numeroFogo: `${prefixo}${digitoAno}${contagemFormatada}`,
  };
}
