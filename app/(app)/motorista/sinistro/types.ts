export type SinistroMotoristaActionState =
  | { ok: false; error: string | null }
  | { ok: true; redirectTo: string };

export const SINISTRO_MOTORISTA_INITIAL_STATE: SinistroMotoristaActionState = {
  ok: false,
  error: null,
};
