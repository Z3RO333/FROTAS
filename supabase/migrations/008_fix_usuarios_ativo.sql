-- Migration 008 — Fix usuários desativados pelo bug do checkbox "ativo"
-- O bug: updateUsuarioAction lia formData.get("ativo") que retornava sempre "false"
--        (por causa do hidden input vir antes do checkbox no DOM).
-- Resultado: TODO update de usuário desativava a pessoa, mesmo com o checkbox marcado.
-- Fix de código: lib/(app)/administracao/usuarios/_actions.ts agora usa getAll().
--
-- Este script:
--   1. Mostra os usuários inativos com sua última alteração (audita o impacto)
--   2. Reativa o Daniel Damasceno como GESTOR
--   3. (Opcional) Reativa todos que ficaram desativados nas últimas 24h
--
-- Rode os blocos separadamente, conforme necessidade.

-- ─── PASSO 1 — Auditar inativos recentes ─────────────────────────────────────
SELECT id, nome, email, perfil, ativo, atualizado_em, atualizado_por
FROM public.usuarios
WHERE ativo = false
ORDER BY atualizado_em DESC NULLS LAST
LIMIT 20;

-- ─── PASSO 2 — Reativar Daniel Damasceno como GESTOR ─────────────────────────
-- Ajuste o email se o domínio for diferente.
UPDATE public.usuarios
SET ativo = true,
    perfil = 'GESTOR',
    atualizado_em = now(),
    atualizado_por = 'fix-bug-checkbox-ativo'
WHERE lower(nome) LIKE '%damasceno%'
   OR lower(email) IN (
     'danieldamasceno@bemol.com.br',
     'daniel.damasceno@bemol.com.br'
   )
RETURNING id, nome, email, perfil, ativo;

-- ─── PASSO 3 (opcional) — Reativar TODOS desativados nas últimas 24h ─────────
-- Use se confirmar que o bug afetou outras pessoas além do Daniel.
-- Descomente para executar:
--
-- UPDATE public.usuarios
-- SET ativo = true,
--     atualizado_em = now(),
--     atualizado_por = 'fix-bug-checkbox-ativo'
-- WHERE ativo = false
--   AND atualizado_em > now() - interval '24 hours'
-- RETURNING id, nome, email, perfil;
