# Auditoria mobile — Frotas Bemol

Data: 30/07/2026  
Escopo: shell, autenticação, dashboards, frota, checklists, portaria, motorista, manutenção, planejamento, documentos, pneus, sinistros, relatórios e administração.

## 1. Método e cobertura

A auditoria combinou:

- inspeção de todas as rotas e componentes React em `app/` e `components/`;
- comparação das capturas desktop e mobile fornecidas com a árvore real de layout;
- análise dos breakpoints em 320, 360, 390 e 430 px (retrato) e 568, 740 e 844 px (paisagem);
- cenários de texto longo, lista vazia, 50–200 registros, dados nulos, toque repetido, conexão perdida, localização negada, sessão expirada e teclado virtual;
- verificação dos estados de carregamento, erro, vazio, confirmação e sucesso;
- validação estática e automatizada após as alterações.

Rotas inspecionadas: login e acesso bloqueado; dashboard; veículos (lista, detalhe, cadastro, edição, vendidos e disponibilidade); checklists (admin, validação de KM, formulário e históricos do motorista); portaria; pendências; sinistros; documentos; pneus; unidades; equipamentos; oficinas; operação; serviços, ordens e custos; todas as páginas de planejamento; relatórios de checklists; usuários, motoristas e e-mails; início, checklist, sinistro, socorro e históricos do motorista.

Limite da evidência: a sessão OAuth corporativa não pode ser automatizada fora de uma conta de teste. A auditoria de Android/iOS físico, teclado real, gesto nativo de voltar, câmera HEIC e expiração real do token permanece no checklist de homologação. Isso não impediu a confirmação do defeito estrutural da captura, pois ele estava diretamente no `AppShell` e era reproduzível pelos breakpoints do código.

## 2. Bugs encontrados

Legenda de estado: **corrigido** nesta entrega; **parcial** quando a proteção compartilhada foi aplicada, mas páginas legadas ainda devem migrar; **backlog** quando exige desenho de produto, dado inexistente ou dispositivo físico.

### M01 — Sidebar desktop duplicada no mobile

- Tela/componente: todas as telas administrativas; `AppShell` e `AppSidebar`.
- Problema: a sidebar desktop continuava visível abaixo de `lg`, enquanto o botão do menu mobile também era renderizado. O banner do caminhão e uma faixa horizontal de links ocupavam o topo, empurravam o conteúdo e produziam a área cortada mostrada na captura.
- Reprodução: entrar como GESTOR/ADMIN, abrir qualquer rota em 360 × 800 px.
- Impacto: navegação confusa, perda de espaço útil e ações importantes abaixo da dobra.
- Severidade: **crítico**.
- Correção/exemplo: sidebar somente a partir de 1024 px; abaixo disso, um único drawer acessível de até 88% da largura.
- Arquivos: `components/app-shell.tsx`, `components/mobile-nav.tsx`, `components/app-sidebar.tsx`.
- Estado: **corrigido**.

### M02 — Cabeçalho estoura com nome/e-mail longo

- Tela/componente: cabeçalho global e `UserMenu`.
- Problema: marca, hambúrguer, nome, e-mail e logout competiam pela mesma linha; a conta podia empurrar ou cortar a navegação em 320–390 px.
- Reprodução: usar nome com mais de 24 caracteres em 320 px.
- Impacto: identidade truncada de forma imprevisível e botão sair fora da zona confortável.
- Severidade: **alto**.
- Correção/exemplo: nome limitado e truncado no mobile, e-mail apenas a partir de `md`, logout com alvo de 44 px.
- Arquivos: `components/app-shell.tsx`, `components/user-menu.tsx`.
- Estado: **corrigido**.

### M03 — Menu mobile sem foco contido e com rolagem do fundo

- Tela/componente: menu hambúrguer.
- Problema: drawer artesanal não era um diálogo, não continha o foco e permitia interação/rolagem do conteúdo atrás.
- Reprodução: abrir o menu, navegar por teclado ou leitor de tela e tentar rolar o fundo.
- Impacto: perda de contexto e barreira para tecnologia assistiva.
- Severidade: **alto**.
- Correção/exemplo: drawer baseado em Radix Dialog, com overlay, bloqueio de rolagem, foco, Escape, rótulos e `aria-current`.
- Arquivo: `components/mobile-nav.tsx`.
- Estado: **corrigido**. O gesto físico “voltar” precisa de homologação Android; ver M19.

### M04 — Modais maiores que a área visível

- Tela/componente: confirmações, upload/edição de documentos, manutenção, relatórios e auditoria de usuários.
- Problema: `DialogContent` tinha largura total e nenhuma altura máxima/rolagem; teclado e telas em paisagem podiam esconder rodapé e botões.
- Reprodução: abrir um diálogo com formulário em 568 × 320 px ou com teclado aberto.
- Impacto: usuário não consegue cancelar/salvar.
- Severidade: **alto**.
- Correção/exemplo: largura com margem de 12 px, `max-height: calc(100dvh - 24px)`, rolagem interna, botão fechar 44 px e rodapé empilhado no mobile.
- Arquivos: `components/ui/dialog.tsx`, `components/ui/sheet.tsx` e consumidores.
- Estado: **corrigido** no componente compartilhado.

### M05 — Áreas de toque abaixo de 44 px

- Tela/componente: botões, selects, filtros, fechar modal e ações OK/Problema.
- Problema: alturas de 32, 36 e 40 px, especialmente em botões de ícone e chips.
- Reprodução: navegar com uma mão em tela de 320/360 px.
- Impacto: toques errados e lentidão operacional.
- Severidade: **alto**.
- Correção/exemplo: 44–48 px no mobile, preservando densidade desktop nos breakpoints maiores.
- Arquivos: `components/ui/button.tsx`, `input.tsx`, `select.tsx`, `filter-bar.tsx`, `driver-checklist-form.tsx`, formulários de sinistro.
- Estado: **parcial**; componentes centrais e fluxos críticos corrigidos. Botões HTML legados de páginas de planejamento devem migrar para `Button`.

### M06 — Checklists administrativos exigiam rolagem horizontal

- Tela/componente: `/checklists`, tabela “Registros recentes”.
- Problema: seis colunas eram apresentadas como tabela desktop no celular.
- Reprodução: abrir a página em 320–430 px com registros.
- Impacto: placa, KM e status ficam fora da tela; comparação exige arrastar lateralmente.
- Severidade: **alto**.
- Correção/exemplo: cards mobile com Data/Frota/Status no cabeçalho e Placa/KM/Rota/Motorista em grade; tabela preservada a partir de `md`.
- Arquivo: `app/(app)/checklists/page.tsx`.
- Estado: **corrigido**.

### M07 — Filtros de checklist tinham larguras fixas

- Tela/componente: `ChecklistFilters`.
- Problema: select de 180 px, datas de 160 px e textos “ou intervalo/até” geravam quebra irregular e controles espremidos.
- Reprodução: 320 px, selecionar intervalo e aumentar fonte do sistema.
- Impacto: filtro difícil de entender e tocar.
- Severidade: **alto**.
- Correção/exemplo: campos com rótulos persistentes, uma coluna no celular, duas no tablet e grade completa no desktop, com feedback “Atualizando”.
- Arquivo: `components/checklists/checklist-filters.tsx`.
- Estado: **corrigido**.

### M08 — Filtro de rota inexistente

- Tela/componente: `/checklists`.
- Problema: não era possível restringir registros por rota/unidade operacional.
- Reprodução: tentar consultar apenas veículos de “AM - MANAUS” ou “CD Boa Vista”.
- Impacto: triagem manual lenta e propensa a erro.
- Severidade: **médio**.
- Correção/exemplo: select “Rota / unidade”, alimentado pelos valores ativos e não vendidos de `veiculos.local`, combinável com período e datas. A rota também aparece nos cards/tabela.
- Arquivos: `components/checklists/checklist-filters.tsx`, `app/(app)/checklists/page.tsx`, `lib/repos/checklists.ts`.
- Estado: **corrigido**, sem migration ou alteração de regra de negócio.

### M09 — Etapas do checklist ultrapassavam 320 px

- Tela/componente: formulário `/motorista/checklist`.
- Problema: os três títulos longos e chevrons estavam em uma linha sem quebra.
- Reprodução: 320/360 px ou fonte ampliada.
- Impacto: etapa atual cortada e impressão de fluxo quebrado.
- Severidade: **alto**.
- Correção/exemplo: no mobile, “Etapa 1 de 3 · Selecionar veículo” e barra de progresso; trilha completa apenas a partir de 640 px.
- Arquivo: `components/checklists/driver-checklist-form.tsx`.
- Estado: **corrigido**.

### M10 — Tabela de seleção de veículo cortava o modelo

- Tela/componente: primeira etapa do checklist.
- Problema: quatro colunas dentro de um contêiner com `overflow-hidden`; a coluna Modelo e badges eram cortados.
- Reprodução: listar veículos em 320–390 px.
- Impacto: seleção ambígua e perda do motivo de indisponibilidade.
- Severidade: **alto**.
- Correção/exemplo: Frota e Placa permanecem visíveis no celular; Modelo/badges entram em telas maiores e o contêiner aceita rolagem local como salvaguarda.
- Arquivo: `components/checklists/driver-checklist-form.tsx`.
- Estado: **corrigido**.

### M11 — Veículo selecionado espremia o botão Prosseguir

- Tela/componente: primeira etapa do checklist.
- Problema: texto longo de modelo/local e botão dividiam uma linha estreita.
- Reprodução: selecionar frota com modelo/local extensos em 320 px.
- Impacto: botão estreito ou texto sobreposto.
- Severidade: **médio**.
- Correção/exemplo: card empilhado e botão de largura total no celular.
- Arquivo: `components/checklists/driver-checklist-form.tsx`.
- Estado: **corrigido**.

### M12 — Navegação do motorista tinha duas ações sem rótulo

- Tela/componente: barra inferior do motorista.
- Problema: Checklist e Sinistro eram círculos elevados somente com ícones, difíceis de distinguir; dois elementos flutuantes também aumentavam poluição e risco de sobreposição.
- Reprodução: usar o sistema sem conhecer os ícones.
- Impacto: ação errada em rotina operacional.
- Severidade: **médio**.
- Correção/exemplo: cinco destinos consistentes, sempre com ícone e rótulo, estado ativo e safe area do iOS.
- Arquivo: `components/motorista/bottom-action-bar.tsx`.
- Estado: **corrigido**.

### M13 — Barra de filtros fixa ocupava a maior parte da tela

- Tela/componente: Portaria e Documentos.
- Problema: filtros `sticky` com busca e muitos chips podem ocupar 35–55% da altura em celulares/paisagem.
- Reprodução: 568 × 320 px, rolar lista com filtros abertos.
- Impacto: poucos registros visíveis e sensação de tela travada.
- Severidade: **médio**.
- Correção/exemplo: sticky somente a partir de 640 px; no mobile os filtros rolam com a página.
- Arquivo: `components/ui/filter-bar.tsx`.
- Estado: **corrigido**.

### M14 — Estado offline estava oculto no celular

- Tela/componente: cabeçalho global.
- Problema: “Sem conexão” só aparecia em `lg`; justamente o usuário móvel não recebia aviso.
- Reprodução: desativar rede em 390 px.
- Impacto: toques repetidos e incerteza sobre salvamento.
- Severidade: **alto**.
- Correção/exemplo: badge “Offline” visível no mobile com anúncio `aria-live`; estado online continua compacto/oculto.
- Arquivo: `components/online-status.tsx`.
- Estado: **corrigido**. Fila offline continua backlog (M20).

### M15 — “Sua frota atual” não consulta atribuição do motorista

- Tela/componente: `/motorista`.
- Problema: a tela usa `listFrotas({ pageSize: 1 })`, que devolve o primeiro veículo da lista global, não uma atribuição atual do usuário.
- Reprodução: entrar com dois motoristas diferentes; ambos podem ver a mesma primeira frota.
- Impacto: motorista pode iniciar checklist no veículo errado.
- Severidade: **crítico** funcional.
- Correção sugerida/exemplo: obter a última movimentação aberta/atribuição ativa do e-mail; na ausência, exibir “Nenhuma frota atribuída”.
- Arquivos prováveis: `app/(app)/motorista/page.tsx`, `lib/repos/motoristas.ts`, `lib/repos/checklists.ts`.
- Estado: **backlog**; depende da definição oficial de “atribuição atual” e não foi alterado para preservar a regra de negócio.

### M16 — Formulários perdem rascunho ao voltar, expirar sessão ou atualizar

- Tela/componente: checklist, sinistro, socorro, frota e documentos.
- Problema: o estado vive apenas em memória; não há aviso nem restauração. Arquivos de câmera também não podem ser reconstruídos automaticamente.
- Reprodução: preencher metade, usar voltar/atualizar ou deixar a sessão expirar.
- Impacto: retrabalho grande em campo.
- Severidade: **alto**.
- Correção sugerida/exemplo: rascunho versionado em `sessionStorage` para texto/seleções, confirmação ao abandonar, aviso de fotos que precisam ser refeitas e retomada após login.
- Arquivos prováveis: formulários em `components/checklists`, `components/sinistros`, `components/frotas`; novo hook compartilhado.
- Estado: **backlog**.

### M17 — Máscaras e validação de telefone/CPF são inconsistentes

- Tela/componente: sinistro e socorro.
- Problema: alguns campos apenas removem não dígitos; terceiros não recebem máscara visual nem erro por campo. Mensagens do servidor aparecem no topo.
- Reprodução: digitar CPF curto, telefone com DDD incompleto ou caracteres colados.
- Impacto: dados inválidos e difícil correção.
- Severidade: **médio**.
- Correção sugerida/exemplo: máscara progressiva, `autocomplete="tel"`, validação inline, resumo de erro com foco no primeiro campo.
- Arquivos: `components/sinistros/driver-sinistro-form.tsx`, `socorro-form.tsx`, actions e schemas Zod.
- Estado: **backlog**.

### M18 — Localização negada gera mensagem genérica

- Tela/componente: sinistro e socorro.
- Problema: timeout, permissão negada e GPS indisponível terminam quase sempre em “não foi possível obter”.
- Reprodução: negar localização ou selecionar “não permitir novamente”.
- Impacto: usuário não sabe que pode digitar endereço nem como reativar permissão.
- Severidade: **médio**.
- Correção sugerida/exemplo: mensagens específicas por `GeolocationPositionError.code`, manter endereço manual em foco e link de instrução Android/iOS.
- Arquivos: `components/sinistros/driver-sinistro-form.tsx`, `socorro-form.tsx`.
- Estado: **backlog**.

### M19 — Botão físico Voltar com overlays precisa de teste nativo

- Tela/componente: menu, sheets de veículo/checklist e diálogos.
- Problema: Escape e fechamento visual estão cobertos pelo Radix, mas o histórico do navegador não registra necessariamente cada overlay; Android pode voltar de rota antes de fechar dependendo do WebView.
- Reprodução: abrir drawer/sheet no Chrome Android e usar gesto/botão Voltar.
- Impacto: saída inesperada da tela e possível perda de rascunho.
- Severidade: **alto**.
- Correção sugerida/exemplo: homologar e, se necessário, integrar overlays ao histórico com estado sentinela, sem duplicar entradas ao clicar em links.
- Arquivos: `components/mobile-nav.tsx`, `components/ui/sheet.tsx`, consumidores.
- Estado: **backlog de homologação física**.

### M20 — Não existe fila offline para ações operacionais

- Tela/componente: checklist, portaria, sinistro e manutenção.
- Problema: o badge informa desconexão, mas salvar/enviar ainda falha; não há rascunho transacional ou estado “aguardando sincronização”.
- Reprodução: iniciar envio e desligar a rede/fechar a tela.
- Impacto: operação duplicada, perda ou dúvida sobre conclusão.
- Severidade: **alto**.
- Correção sugerida/exemplo: rascunho local, `submission_id` persistente, status “pendente de envio”, retry controlado e confirmação do servidor. Checklists/sinistros já possuem chave de submissão, uma boa base para idempotência.
- Arquivos: service worker, formulários operacionais, actions e camada de persistência.
- Estado: **backlog**.

### M21 — Listas administrativas legadas continuam dependentes de tabelas

- Tela/componente: Equipamentos, Motoristas, Ordens, Serviços, Operação, Unidades, parte de Planejamento e Relatórios.
- Problema: `overflow-x-auto` impede o estouro da página, mas ainda exige arraste lateral e esconde contexto/ações.
- Reprodução: abrir listas com dados em 320–430 px.
- Impacto: comparação lenta e ações difíceis de encontrar.
- Severidade: **médio** (alto para ações operacionais frequentes).
- Correção sugerida/exemplo: padrão já usado em Veículos, Documentos e Checklists: cards abaixo de `md`, tabela acima; ação principal visível e detalhes secundários em sheet.
- Arquivos: páginas com `<table>` em `app/(app)` e componentes de relatório.
- Estado: **backlog por tela**.

### M22 — Listas de 100–200 itens não têm paginação/virtualização uniforme

- Tela/componente: Checklists, Pendências, Portaria e históricos.
- Problema: limites fixos silenciosos e renderização longa; o usuário não sabe se vê todos os resultados.
- Reprodução: base com mais de 100 checklists ou 200 pendências.
- Impacto: registro aparentemente ausente e rolagem pesada.
- Severidade: **médio**.
- Correção sugerida/exemplo: paginação por cursor, total/“mostrando X de Y”, carregar mais e preservação do filtro.
- Arquivos: repositórios e páginas correspondentes; `components/ui/page-pagination.tsx`.
- Estado: **backlog**.

### M23 — Estados de sucesso/erro/carregamento não são uniformes

- Tela/componente: actions administrativas e páginas de planejamento.
- Problema: alguns fluxos usam toast, outros texto no topo, redirect ou nenhum feedback local; ações de Pendências são formulários diretos sem indicador individual.
- Reprodução: rede lenta e toque em “Resolver”, “Liberar frota” ou salvar edição.
- Impacto: repetição de toque e dúvida se a ação ocorreu.
- Severidade: **alto**.
- Correção sugerida/exemplo: botão pendente com spinner, bloqueio só da ação atual, toast de sucesso, erro inline recuperável e estado de reconexão.
- Arquivos: actions client/server e componentes de formulário em todas as áreas.
- Estado: **parcial**; formulários de motorista e componentes novos já bloqueiam repetição.

### M24 — Ações destrutivas/irreversíveis nem sempre confirmam

- Tela/componente: pendências, usuários, unidades/equipamentos e algumas manutenções.
- Problema: padrão `ConfirmDialog` existe, mas nem toda ação de liberar/resolver/excluir o utiliza.
- Reprodução: tocar acidentalmente numa ação próxima em um card.
- Impacto: mudança operacional não intencional.
- Severidade: **alto**.
- Correção sugerida/exemplo: confirmação com objeto afetado, consequência, botão destrutivo separado e feedback após concluir.
- Arquivos: páginas/actions citadas e `components/ui/confirm-dialog.tsx`.
- Estado: **backlog**.

### M25 — Texto longo é truncado sem caminho consistente para leitura

- Tela/componente: modelos, locais, motivos, destinatários, resumos IA e nomes.
- Problema: vários `truncate/max-w` dependem de `title`, que não funciona por toque e não é uma solução acessível.
- Reprodução: nome/modelo/motivo acima de 40 caracteres no celular.
- Impacto: informação operacional importante fica invisível.
- Severidade: **médio**.
- Correção sugerida/exemplo: duas linhas em cards e botão “Ver detalhes”/sheet; `title` apenas como complemento desktop.
- Arquivos: tabelas de frotas, disponibilidade, relatórios, manutenção e cards.
- Estado: **parcial**; cards de checklist usam quebra de palavra.

### M26 — Tipografia auxiliar chega a 10 px

- Tela/componente: badges, sidebar, KPIs, tabs e barra inferior.
- Problema: textos de 10–10,5 px ficam difíceis com brilho externo, fonte ampliada ou baixa visão.
- Reprodução: Android com fonte grande ou uso externo.
- Impacto: legibilidade reduzida.
- Severidade: **baixo/médio**.
- Correção sugerida/exemplo: conteúdo essencial mínimo 12 px; 10–11 px somente para metadado redundante, contraste AA e sem caixa alta longa.
- Arquivos: design tokens e componentes compartilhados.
- Estado: **backlog de padronização**.

### M27 — Paisagem baixa comprime heróis, filtros e barra inferior

- Tela/componente: Documentos, Dashboard, páginas do motorista.
- Problema: heróis e KPIs empilhados consomem quase toda a altura de 320–390 px; barra inferior permanece fixa.
- Reprodução: 844 × 390 ou 568 × 320.
- Impacto: conteúdo principal aparece só após muita rolagem.
- Severidade: **médio**.
- Correção sugerida/exemplo: variante compacta por `@media (orientation: landscape) and (max-height: 480px)`, reduzir decoração/descrição e permitir barra inferior mais baixa.
- Arquivos: `page-header.tsx`, `bottom-action-bar.tsx`, páginas com PageHero.
- Estado: **backlog**.

### M28 — Datas nativas variam entre iOS/Android

- Tela/componente: filtros e formulários com `input type="date"`.
- Problema: aparência, placeholder e acionamento diferem; falta uma mensagem quando início é posterior ao fim.
- Reprodução: selecionar intervalo invertido no Safari iOS e Chrome Android.
- Impacto: filtro vazio sem explicação.
- Severidade: **médio**.
- Correção sugerida/exemplo: validação cruzada imediata, `min/max`, mensagem inline e datas mantidas após erro.
- Arquivos: filtros de checklist e outros filtros de data.
- Estado: **backlog**.

### M29 — Upload/câmera HEIC exige homologação iOS

- Tela/componente: checklist, sinistro e socorro.
- Problema: HEIC/HEIF são aceitos, mas `createImageBitmap` pode não decodificar em versões específicas; há fallback de upload, porém OCR/preview/backend devem ser confirmados.
- Reprodução: foto “Alta eficiência” em iPhone, rede lenta.
- Impacto: foto sem preview ou análise, envio pesado.
- Severidade: **médio**.
- Correção sugerida/exemplo: teste real, mensagem de fallback, compressão/convertedor suportado no servidor e limite explícito por arquivo/total.
- Arquivos: formulários de imagem, APIs de OCR/vision e validação de upload.
- Estado: **backlog de dispositivo físico**.

### M30 — Estado vazio é visualmente inconsistente

- Tela/componente: páginas administrativas e planejamento.
- Problema: algumas usam `EmptyState`, outras uma célula de tabela ou texto simples, sem distinguir “sem dados” de “sem resultado do filtro”.
- Reprodução: usuário sem dados e depois filtro sem correspondência.
- Impacto: usuário não sabe se deve cadastrar, limpar filtro ou tentar novamente.
- Severidade: **baixo**.
- Correção sugerida/exemplo: título, explicação contextual e ação recomendada (“Limpar filtros”, “Cadastrar”, “Tentar novamente”).
- Arquivos: páginas e `components/ui/empty-state.tsx`.
- Estado: **backlog de padronização**.

## 3. Melhorias recomendadas por área

| Área | Manter | Próxima melhoria |
|---|---|---|
| Shell e navegação | Drawer único, cabeçalho compacto, safe area | Homologar gesto Voltar Android e modo paisagem baixo |
| Dashboard | Cards e hierarquia existentes | KPIs compactos no mobile; esconder gráficos secundários atrás de “Ver detalhes” |
| Veículos | Cards mobile + sheet já são bom padrão | Expandir texto longo por toque e revisar edição inline de localização |
| Checklists admin | Cards, filtros rotulados e rota implementados | Paginação por cursor e KPIs sensíveis aos filtros, se desejado pelo produto |
| Checklist motorista | Passos, OCR, idempotência e fotos | Rascunho recuperável, confirmação de saída e resumo final antes de enviar |
| Portaria | Cards operacionais e sheet | Estado pendente por ação, retry e suporte offline controlado |
| Sinistro/Socorro | Controles grandes, câmera e endereço manual | Máscaras, erros por campo, permissão GPS específica e rascunho |
| Documentos | Cards mobile e preview fullscreen | Compactar PageHero em paisagem e mostrar progresso de upload |
| Planejamento/Manutenção | Cards em várias telas | Migrar tabelas restantes para cards/sheets e uniformizar estados |
| Administração | Estrutura funcional | Ações mobile em menu/sheet, confirmações e feedback individual |

## 4. Priorização

1. **P0 — antes de produção:** M15 (frota atual), homologação M19 e confirmação de que o drawer corrigido substituiu a sidebar em todos os perfis.
2. **P1 — próximo ciclo:** M16, M20, M23 e M24; são riscos de perda/duplicação de operação.
3. **P2 — usabilidade operacional:** M17, M18, M21, M22, M25 e M28.
4. **P3 — refinamento:** M26, M27, M29 e M30.

## 5. Padronização visual proposta

- Breakpoints de produto: 320–639 mobile; 640–1023 tablet; 1024+ desktop.
- Área de toque: 44 px mínimo; ação primária 48 px quando isolada.
- Tipografia: título 24/30 mobile e 30/36 desktop; corpo 14–16; metadado essencial nunca abaixo de 12.
- Espaçamento: escala 4/8/12/16/24/32; cards mobile com 16 px; distância mínima de 8 px entre ações.
- Formulário: rótulo sempre visível, exemplo/ajuda abaixo, erro junto do campo, input 16 px no mobile para impedir zoom do iOS.
- Listas: card no mobile, tabela no desktop; informação crítica no topo esquerdo, status no topo direito, ação principal visível.
- Modais: margem de 12 px, altura por `dvh`, rolagem interna, fechar 44 px, rodapé fixável quando necessário.
- Feedback: pendente, sucesso, erro recuperável e offline em toda mutação; nunca depender só de cor.
- Cores: azul para ação/informação, verde para concluído, âmbar para atenção, vermelho para bloqueio/erro, violeta reservado a manutenção; sempre texto/ícone além da cor.
- Movimento: respeitar `prefers-reduced-motion`.

## 6. Plano de implementação

### Etapa A — fundação (realizada nesta entrega)

- corrigir shell/sidebar e menu mobile;
- aplicar alvos de toque, `dvh`, safe area, foco e redução de movimento;
- tornar checklists responsivos e incluir rota;
- corrigir passo e seleção do checklist do motorista;
- exibir falta de conexão no mobile.

### Etapa B — confiabilidade operacional

- definir “frota atual” e corrigir M15;
- criar rascunho/abandono de formulário;
- uniformizar botão pendente, sucesso, retry e confirmação;
- projetar fila offline idempotente.

### Etapa C — migração das listas

- priorizar Pendências, Operação, Serviços e Ordens;
- depois Administração, Equipamentos, Unidades e Planejamento;
- adicionar paginação por cursor e totais.

### Etapa D — homologação e acabamento

- Android/iOS físicos, câmera HEIC, GPS negado, teclado e gesto Voltar;
- paisagem de baixa altura, fonte 200%, leitor de tela e contraste;
- padronizar vazios, textos longos e datas.

## 7. Checklist final de testes mobile

- [ ] 320 × 568, 360 × 800, 390 × 844 e 430 × 932 em retrato.
- [ ] 568 × 320, 740 × 360 e 844 × 390 em paisagem.
- [ ] Chrome Android, Safari iOS, Edge/Chrome mobile e PWA instalada.
- [ ] Fonte do sistema normal, grande e 200% de zoom.
- [ ] Drawer abre, contém foco, rola, fecha por X, overlay, Escape e gesto Voltar.
- [ ] Nenhuma sidebar/banner desktop aparece abaixo de 1024 px.
- [ ] Nenhuma página cria rolagem horizontal global.
- [ ] Cards/tabelas exibem nomes/modelos/rotas longos sem esconder status/ação.
- [ ] Todos os alvos essenciais têm pelo menos 44 × 44 px.
- [ ] Teclado não cobre campo atual, erros ou salvar/enviar.
- [ ] Datas invertidas, campos nulos e caracteres inesperados geram mensagem clara.
- [ ] Lista vazia e filtro sem resultado têm mensagens/ações diferentes.
- [ ] Listas com 200+ registros mantêm desempenho e informam paginação/limite.
- [ ] GPS permitido, negado, indisponível e timeout; endereço manual continua possível.
- [ ] Câmera JPEG, PNG, WebP e HEIC; arquivo grande e extensão inválida.
- [ ] Rede lenta, offline antes do envio e queda durante envio.
- [ ] Toque repetido não duplica checklist, sinistro, movimentação ou manutenção.
- [ ] Atualizar/fechar/voltar durante ação informa estado e preserva o que for seguro.
- [ ] Sessão expirada no meio do formulário retorna ao rascunho após login.
- [ ] Leitor de tela anuncia labels, erro, offline, modal e estado ativo.
- [ ] Contraste AA e `prefers-reduced-motion`.
- [ ] Uso com polegar: ações principais acessíveis sem precisão excessiva.

## 8. Evidências de não regressão

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm test`: 8 arquivos e 39 testes aprovados.
- consulta real do filtro: rota `AM - MANAUS` encontrou 210 veículos e 1 checklist vinculado na base no momento do teste.
- nenhuma migration foi criada; “rota” reutiliza `veiculos.local` e não altera regras de negócio.
- `npm run build`: compilação de produção aprovada, incluindo geração e checagem das 58 rotas listadas pelo Next.js.
- evidência visual de componentes com dados simulados: [320 × 568](evidencias/mobile-320x568.png), [390 × 844](evidencias/mobile-390x844.png) e [844 × 390 paisagem](evidencias/mobile-844x390-landscape.png). As capturas confirmam cabeçalho sem sidebar duplicada, ausência de rolagem horizontal global, KPIs responsivos, nome longo truncado e filtros em largura útil.
- validações ainda obrigatórias antes do aceite: smoke autenticado dos perfis e matriz física Android/iOS acima.

## 9. Correção posterior — frotas novas nos formulários operacionais

Foi confirmado que checklist, sinistro e socorro usavam `listFrotas({ pageSize: 200 })`. Como `listFrotas` limita deliberadamente cada página a 200 registros e ordena por ID crescente, veículos novos ficavam fora do seletor quando a base ultrapassava esse total. Os três fluxos agora usam `listFrotasForOperationalForms`, que percorre todas as frotas ativas e não vendidas em blocos de 1.000. Os bloqueios já existentes de manutenção, venda e saída da base continuam sendo aplicados pelos formulários/actions.
