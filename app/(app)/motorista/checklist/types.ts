export type ChecklistMotoristaActionState =
  | { ok: true; redirectTo: string; error?: never }
  | { ok: false; error: string; redirectTo?: never };

export const CHECKLIST_MOTORISTA_INITIAL_STATE: ChecklistMotoristaActionState = {
  ok: false,
  error: "",
};
