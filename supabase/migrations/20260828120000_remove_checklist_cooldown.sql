-- Remove o cooldown entre checklists da mesma frota.
begin;

drop trigger if exists trg_prevent_checklist_during_cooldown on public.checklists_frota;
drop function if exists public.prevent_checklist_during_cooldown();

commit;
