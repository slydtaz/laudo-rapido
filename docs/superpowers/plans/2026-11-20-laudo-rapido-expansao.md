# LaudoRápido Expansão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Baratear e ampliar a vitrine de planos, adicionar histórico de laudos, resumo local na home e logout, mantendo PWA/offline e i18n.

**Architecture:** Mudanças apenas no cliente mais uma rota de API de logout. Dados do histórico vêm do `GET /api/v1/visitas` já existente; o resumo da home vem do IndexedDB via funções já existentes da fila offline. Novas chaves entram no dicionário tipado dos 5 idiomas.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, Vitest + Testing Library, Dexie, Drizzle/PGlite nos testes.

**Spec:** `docs/superpowers/specs/2026-11-20-laudo-rapido-expansao-design.md`

## Global Constraints

- 5 idiomas com as mesmas chaves: ptBR, en, es, fr, de. PT-BR é padrão.
- Rótulos preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`.
- Rotas preservadas: `/api/v1/*`, `/o/:token`, `/api/health`, `/visitas/nova`.
- Nenhuma dependência nova de runtime. Nenhuma cobrança real.
- Sem build com dev server ativo: parar dev, limpar `.next` se houver erro de chunk, rodar build, reiniciar.
- Commits locais apenas; sem push, merge ou deploy. Nunca ler `.env.local`.

## Review Focus

- Dicionário incompleto em algum idioma quebra `ChaveTexto` em tempo de compilação → teste de paridade de chaves (Task 1).
- Histórico com many visitas e busca vazia/erro/offline → teste do filtro puro e estados da tela (Task 2).
- Resumo local quando IndexedDB falha ou não há sessão → funções existentes retornam zero; home trata `catch` (Task 3).
- Logout com cookie expirado deve ainda limpar o cookie → middleware trata `/api/v1/auth/logout` como público (Task 4).
- Vitrine nova em 375 px com 4 cards não pode overflowar → grid responsivo e auditoria visual (Task 5).

---

### Task 1: Planos baratos + camada Enterprise

**Files:**
- Modify: `src/lib/i18n/dicionario.ts` (chaves `plano*`, `planosFaq3*`)
- Modify: `src/app/planos/page.tsx` (4 planos, grid, flag `semPeriodo`, FAQ 3)
- Test: `tests/planos.test.ts` (novo)

**Interfaces:**
- Consumes: `useT()`, `ChaveTexto`, `IDIOMAS_TEXTOS`.
- Produces: 4 planos na vitrine; preços `R$ 0`, `R$ 19,90`, `R$ 39,90`, `Sob consulta`; chave `planoEquipe*`.

- [ ] **Step 1: escrever teste que falha** — `tests/planos.test.ts` afirma `ptBR.planoProPreco === 'R$ 19,90'`, `ptBR.planoEquipePreco === 'R$ 39,90'`, `ptBR.planoEmpresas === 'Enterprise'`, presença de `planoEquipeItens` e `planosFaq3R` nos 5 idiomas.
- [ ] **Step 2: rodar e ver falhar** — `corepack pnpm vitest run tests/planos.test.ts` → FAIL.
- [ ] **Step 3: implementar** — adicionar chaves nos 5 dicionários; ajustar preços e nomes; vitrine com `PLANOS` de 4 itens, `semPeriodo` para Enterprise, `grid sm:grid-cols-2 xl:grid-cols-4`, FAQ 3.
- [ ] **Step 4: rodar e ver passar** — teste novo + `corepack pnpm test`.
- [ ] **Step 5: commit** — `feat(planos): precos acessiveis e camada enterprise`.

### Task 2: Histórico de laudos

**Files:**
- Create: `src/lib/visita/filtro.ts`
- Create: `src/app/visitas/page.tsx`
- Modify: `src/lib/i18n/dicionario.ts` (chaves `historico*`)
- Modify: `src/app/page.tsx` (card de acesso rápido)
- Test: `tests/filtro.test.ts` (novo)

**Interfaces:**
- Consumes: `GET /api/v1/visitas` → `{ visitas: Array<{ id, token, status, dados: {cliente, tipo, observacoes}, capturadoEm }> }`.
- Produces: `filtrarVisitas(visitas, termo, status)` e `type VisitaHistorico`.

- [ ] **Step 1: escrever teste que falha** — `tests/filtro.test.ts`: termo case-insensitive em cliente/tipo/observações; status `todos|sincronizada|entregue`; combinação termo+status; retorno vazio sem mutar a entrada.
- [ ] **Step 2: rodar e ver falhar** — `corepack pnpm vitest run tests/filtro.test.ts` → FAIL.
- [ ] **Step 3: implementar `filtrarVisitas`** em `src/lib/visita/filtro.ts`.
- [ ] **Step 4: rodar e ver passar** — teste novo.
- [ ] **Step 5: adicionar chaves `historico*` nos 5 idiomas e criar a página** com Skeleton, busca, chips de status, cards com Abrir laudo / Baixar PDF / Copiar link via toast, estados vazio/erro.
- [ ] **Step 6: adicionar card "Histórico de laudos" na home.**
- [ ] **Step 7: rodar suíte** — `corepack pnpm test`.
- [ ] **Step 8: commit** — `feat(historico): consulta de laudos enviados`.

### Task 3: Resumo local na home

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/lib/i18n/dicionario.ts` (chave `homeResumo`)
- Test: `tests/i18n.test.ts` (paridade já cobre novas chaves)

**Interfaces:**
- Consumes: `pendenciasRestantes(empresaId)`, `entregasSalvas(empresaId)`, `/api/v1/sessao`.

- [ ] **Step 1: teste que falha** — adicionar em `tests/i18n.test.ts` assertiva de que `homeResumo` existe nos 5 idiomas e não vazia (paridade já garante forma, mas a assertiva nomeia o contrato).
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar** — bloco "Seu resumo" com dois números (pendentes/entregues), buscando empresaId da sessão e caçando falhas para zero; usar `homePendentes`/`homeEntregas`.
- [ ] **Step 4: rodar suíte e ver passar.**
- [ ] **Step 5: commit** — `feat(home): resumo local de pendencias e entregas`.

### Task 4: Logout

**Files:**
- Create: `src/app/api/v1/auth/logout/route.ts`
- Modify: `src/lib/auth/session.ts` (exportar `extrairTokenCookie` e `encerrarSessao`)
- Modify: `src/middleware.ts` (rota pública)
- Modify: `src/app/configuracoes/page.tsx` (botão Sair)
- Modify: `src/lib/i18n/dicionario.ts` (chaves `configSessao`, `configSair`, `configSairDica`, `configSaiu`)
- Test: `tests/logout.test.ts` (novo)

**Interfaces:**
- Consumes: `criarSessao`, `lerSessao`, `criarBancoTeste`, `setBancoAtivo`.
- Produces: `encerrarSessao(req): Promise<boolean>` e rota `POST /api/v1/auth/logout`.

- [ ] **Step 1: teste que falha** — `tests/logout.test.ts`: token extraído do cookie; `encerrarSessao` remove registro e `lerSessao` passa a retornar `null`; cookie ausente retorna `false` sem erro.
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar helper + rota + middleware + botão com toast e `router.replace('/login')`.**
- [ ] **Step 4: rodar suíte e ver passar.**
- [ ] **Step 5: commit** — `feat(auth): logout com limpeza de sessao`.

### Task 5: Auditoria visual e build

**Files:** artefatos em `artifacts/ui-audit`; nenhum código novo salvo a menos que a auditoria encontre defeito.

- [ ] **Step 1: parar dev, limpar `.next` se necessário, rodar `corepack pnpm build` com dev parado, reiniciar dev.**
- [ ] **Step 2: browser: 375/768/1280/1440 em claro/escuro nas telas `/`, `/visitas`, `/planos`, `/configuracoes`; verificar overflow, contraste e alvos ≥44 px.**
- [ ] **Step 3: corrigir defeitos encontrados com teste quando aplicável; commit único `fix(ui): ajustes de auditoria` se houver.**
- [ ] **Step 4: commit final do ledger/progresso e relatório de evidências.**
