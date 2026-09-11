export type ReparoFrotaActionState =
  | { ok: false; error: string | null }
  | { ok: true; redirectTo: string };

export const REPARO_FROTA_INITIAL_STATE: ReparoFrotaActionState = {
  ok: false,
  error: null,
};
