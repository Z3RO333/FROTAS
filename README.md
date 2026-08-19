# Plataforma de Gestão de Frotas

Sistema Full-Stack para centralizar gestão operacional de frota, documentos, pneus, checklists e automações em uma única plataforma.

## Visão geral

O projeto nasceu para substituir controles dispersos e processos manuais por uma aplicação web integrada. A solução concentra informações de veículos, documentos e operação, além de automatizar importações, validações e tarefas administrativas.

## Principais funcionalidades

- Gestão de frotas e unidades
- Controle e consulta de documentos de veículos
- Gestão de pneus e ativos relacionados
- Checklists e fluxos operacionais
- Perfis de acesso e autenticação
- Importação de dados por planilhas
- Rotinas de migração e backfill
- Geração e manipulação de PDFs
- Dashboards e indicadores operacionais
- Integrações com banco de dados e serviços externos
- Automação de tarefas administrativas

## Stack principal

- Next.js 16
- React 19
- TypeScript
- Supabase / PostgreSQL
- NextAuth / Auth.js
- Tailwind CSS
- Radix UI
- Recharts
- OpenAI API
- Zod
- Vitest
- Node.js

## Destaques técnicos

- arquitetura web moderna com App Router
- banco relacional integrado ao Supabase
- autenticação e controle de acesso
- importação e tratamento de dados XLSX
- OCR e processamento de documentos
- geração e manipulação de PDF
- scripts de migração e manutenção de dados
- testes automatizados
- estrutura preparada para evolução modular

## Objetivo

Reduzir dependência de planilhas e controles manuais, melhorar rastreabilidade e oferecer uma visão centralizada da operação de frota.

## Segurança

O projeto pode conter integrações e regras de contexto corporativo. Credenciais, tokens, dados reais, documentos internos e informações sensíveis não devem ser expostos publicamente.

## Execução local

```bash
npm install
npm run dev
```

Validação:

```bash
npm run build
npm run lint
npm run typecheck
npm run test
```
