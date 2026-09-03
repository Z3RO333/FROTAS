export type ChecklistGrupo = "Seguranca" | "Mecanica" | "Rodagem" | "Documentacao" | "Conservacao";
export type ChecklistStatusItem = "APTO" | "NAO_APTO" | "NAO_SE_APLICA";
export type ChecklistStatusGeral = "APROVADO" | "COM_OBSERVACAO" | "NAO_APTO" | "CRITICO";
export type GravidadePendencia = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

export type ChecklistCatalogItem = {
  codigo: string;
  nome: string;
  grupo: ChecklistGrupo;
  obrigatorio: boolean;
  critico: boolean;
};

export const CHECKLIST_ITEMS: ChecklistCatalogItem[] = [
  { codigo: "iluminacao", nome: "Iluminação", grupo: "Seguranca", obrigatorio: false, critico: false },
  { codigo: "tacografo", nome: "Tacógrafo", grupo: "Seguranca", obrigatorio: false, critico: false },
  {
    codigo: "kit_seguranca",
    nome: "Kit segurança (triângulo, macaco, chave de roda e extintor)",
    grupo: "Seguranca",
    obrigatorio: true,
    critico: false,
  },
  { codigo: "limpador", nome: "Limpador de para-brisa", grupo: "Seguranca", obrigatorio: true, critico: false },
  { codigo: "motor_oleo", nome: "Motor / Óleo", grupo: "Mecanica", obrigatorio: true, critico: false },
  { codigo: "freios", nome: "Freios / Óleo", grupo: "Mecanica", obrigatorio: true, critico: true },
  { codigo: "radiador", nome: "Radiador / purgar", grupo: "Mecanica", obrigatorio: true, critico: false },
  { codigo: "oleo_transmissao", nome: "Transmissão / Óleo", grupo: "Mecanica", obrigatorio: false, critico: false },
  { codigo: "oleo_plataforma", nome: "Plataforma / Óleo", grupo: "Mecanica", obrigatorio: false, critico: false },
  { codigo: "arla", nome: "Arla", grupo: "Mecanica", obrigatorio: false, critico: false },
  { codigo: "pneus_step", nome: "Pneus / step", grupo: "Rodagem", obrigatorio: true, critico: true },
  { codigo: "documento", nome: "Documento do veículo", grupo: "Documentacao", obrigatorio: true, critico: false },
  { codigo: "cartao_combustivel", nome: "Cartão combustível", grupo: "Documentacao", obrigatorio: false, critico: false },
  { codigo: "bau", nome: "Baú", grupo: "Conservacao", obrigatorio: false, critico: false },
];

export const CHECKLIST_GROUPS: ChecklistGrupo[] = [
  "Seguranca",
  "Mecanica",
  "Rodagem",
  "Documentacao",
  "Conservacao",
];

export function checklistItemByCode(codigo: string): ChecklistCatalogItem | undefined {
  return CHECKLIST_ITEMS.find((item) => item.codigo === codigo);
}
