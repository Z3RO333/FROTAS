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
  { codigo: "iluminacao", nome: "Iluminacao", grupo: "Seguranca", obrigatorio: true, critico: true },
  { codigo: "tacografo", nome: "Tacografo", grupo: "Seguranca", obrigatorio: true, critico: true },
  { codigo: "kit_seguranca", nome: "Kit seguranca", grupo: "Seguranca", obrigatorio: true, critico: false },
  { codigo: "extintor", nome: "Extintor", grupo: "Seguranca", obrigatorio: true, critico: true },
  { codigo: "limpador", nome: "Limpador de para-brisa", grupo: "Seguranca", obrigatorio: true, critico: false },
  { codigo: "cinto", nome: "Cinto de seguranca", grupo: "Seguranca", obrigatorio: true, critico: true },
  { codigo: "motor_oleo", nome: "Motor / oleo", grupo: "Mecanica", obrigatorio: true, critico: false },
  { codigo: "freios", nome: "Freios / oleo", grupo: "Mecanica", obrigatorio: true, critico: true },
  { codigo: "radiador", nome: "Radiador / purgar", grupo: "Mecanica", obrigatorio: true, critico: false },
  { codigo: "oleo_transmissao", nome: "Oleo transmissao", grupo: "Mecanica", obrigatorio: false, critico: false },
  { codigo: "oleo_plataforma", nome: "Oleo plataforma", grupo: "Mecanica", obrigatorio: false, critico: false },
  { codigo: "arla", nome: "Arla", grupo: "Mecanica", obrigatorio: false, critico: false },
  { codigo: "pneus_step", nome: "Pneus / step", grupo: "Rodagem", obrigatorio: true, critico: true },
  { codigo: "rodas", nome: "Rodas", grupo: "Rodagem", obrigatorio: true, critico: false },
  { codigo: "suspensao", nome: "Suspensao visual", grupo: "Rodagem", obrigatorio: true, critico: false },
  { codigo: "documento", nome: "Documento do veiculo", grupo: "Documentacao", obrigatorio: true, critico: false },
  { codigo: "licenciamento", nome: "Licenciamento", grupo: "Documentacao", obrigatorio: true, critico: true },
  { codigo: "cartao_combustivel", nome: "Cartao combustivel", grupo: "Documentacao", obrigatorio: false, critico: false },
  { codigo: "cabine", nome: "Cabine", grupo: "Conservacao", obrigatorio: true, critico: false },
  { codigo: "bau", nome: "Bau", grupo: "Conservacao", obrigatorio: true, critico: false },
  { codigo: "identificacao_visual", nome: "Identificacao visual", grupo: "Conservacao", obrigatorio: true, critico: false },
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
