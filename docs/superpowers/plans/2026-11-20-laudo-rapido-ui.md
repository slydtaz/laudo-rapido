# LaudoRápido UI Premium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (execution method chosen by the human partner). Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Entregar a reforma visual completa com tema, idiomas, skeletons, 404, botões otimistas, configurações e planos, verificada por testes, build e screenshots.

**Architecture:** Reforma apenas no cliente. Tokens CSS e fontes self-hosted alimentam todas as telas; um provedor único guarda tema, idioma e preferências no `localStorage`. Componentes de skeleton e toast são reutilizados. As rotas da API e o fluxo offline não mudam.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS v4, Vitest + Testing Library, `next/font/google`.

**Spec:** `docs/superpowers/specs/2026-11-20-laudo-rapido-ui-design.md`

## Global Constraints

- Não adicionar dependências de runtime.
- Não criar rotas com prefixo de idioma; não alterar `/api/v1`, `/o/:token` ou `/api/health`.
- PT-BR é o idioma padrão; os textos dos botões principais continuam iguais em PT-BR.
- Preservar rótulos, `role` e `aria-label` usados pelos testes existentes.
- Respeitar `prefers-reduced-motion` e o ajuste manual de movimento.
- Nenhuma credencial ou `.env.local` em commits.
- Cada task termina com teste, verificação e commit.

## Review Focus

- Usuário com `localStorage` vazio ou corrompido → valores padrão válidos, sem quebrar a página.
- Tema escuro com contraste insuficiente em texto secundário → mínimo 4,5:1.
- Troca de idioma depois de formulário preenchido → textos mudam, valores permanecem.
- Clique otimista seguido de falha de rede → estado anterior restaurado e erro visível.
- Skeleton que troca de altura ao carregar → reserva de espaço, sem salto de layout.
- Tela em 375 px com teclado aberto → sem rolagem horizontal e alvos de toque ≥ 44 px.

---

### Task 1: Tokens, fontes e provedor de preferências

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Create: `src/lib/config/preferencias.ts`
- Create: `src/components/ProvedorPreferencias.tsx`
- Test: `tests/preferencias.test.ts`

**Interfaces:**
- Produces: `type Preferencias`, `PREFERENCIAS_PADRAO`, `lerPreferencias()`, `salvarPreferencias()`, `usePreferencias()` com `{ preferencias, atualizar }`.

- [x] **Step 1: Escrever teste de leitura de preferências com localStorage vazio e corrompido**
- [x] **Step 2: Rodar o teste e confirmar falha**
- [x] **Step 3: Implementar `PREFERENCIAS_PADRAO`, `lerPreferencias` e `salvarPreferencias` com chave versionada e validação**
- [x] **Step 4: Definir tokens CSS claros/escuros, fontes Sora + DM Sans, estados de foco e utilitários de movimento em `globals.css`**
- [x] **Step 5: Aplicar `data-theme`, `data-motion` e `data-texto` no `<html>` via script inline em `layout.tsx`; montar `ProvedorPreferencias`**
- [x] **Step 6: Rodar teste, build e commit**

### Task 2: Dicionário de cinco idiomas

**Files:**
- Create: `src/lib/i18n/dicionario.ts`
- Create: `src/lib/i18n/useT.ts`
- Modify: `src/components/ProvedorPreferencias.tsx`
- Test: `tests/i18n.test.ts`

**Interfaces:**
- Produces: `useT(): (chave: ChaveTexto) => string`, `IDIOMAS`, `type ChaveTexto`.

- [x] **Step 1: Testar que os cinco idiomas têm exatamente as mesmas chaves e que PT-BR contém os textos atuais dos botões**
- [x] **Step 2: Rodar o teste e confirmar falha**
- [x] **Step 3: Criar o dicionário tipado com ptBR, en, es, fr, de**
- [x] **Step 4: Criar `useT` e expor o idioma pelo provedor, atualizando `document.documentElement.lang`**
- [x] **Step 5: Rodar teste e commit**

### Task 3: Skeleton, toast e 404

**Files:**
- Create: `src/components/Skeleton.tsx`
- Create: `src/components/ToastProvider.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/app/o/[token]/loading.tsx`
- Test: `tests/skeleton.test.tsx`

**Interfaces:**
- Produces: `<Skeleton linhas?: number />`, `useToast(): { avisar(mensagem, tipo?) }`.

- [x] **Step 1: Testar que Skeleton expõe `aria-busy` e que toast anuncia em `aria-live`**
- [x] **Step 2: Rodar o teste e confirmar falha**
- [x] **Step 3: Implementar Skeleton com altura fixa e shimmer**
- [x] **Step 4: Implementar ToastProvider com animação de entrada e saída**
- [x] **Step 5: Criar 404 personalizada e skeleton da rota pública**
- [x] **Step 6: Rodar teste e commit**

### Task 4: Ações otimistas em login e captura

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/visitas/nova/page.tsx`
- Modify: `src/components/AssinaturaCanvas.tsx`
- Test: `tests/acoes-otimistas.test.tsx`

- [x] **Step 1: Testar que o clique limpa o form na hora e que falha restaura o rascunho**
- [x] **Step 2: Rodar o teste e confirmar falha**
- [x] **Step 3: Aplicar confirmação otimista em salvar, sincronizar, copiar link e confirmar assinatura, com toast e rollback**
- [x] **Step 4: Rodar teste e commit**

### Task 5: Telas de início, login e captura

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/visitas/nova/page.tsx`
- Modify: `src/components/AssinaturaCanvas.tsx`
- Test: `tests/ui-screens.test.tsx`

- [x] **Step 1: Testar acessibilidade básica das telas: rótulos, contraste de tokens e foco visível**
- [x] **Step 2: Rodar o teste e confirmar falha**
- [x] **Step 3: Aplicar hierarquia visual, cards, chips de foto, painel de status e micro-interações**
- [x] **Step 4: Rodar teste e capturar screenshots em 375/768/1280/1440, claro e escuro**
- [x] **Step 5: Corrigir defeitos encontrados e commit**

### Task 6: Configurações e planos

**Files:**
- Create: `src/app/configuracoes/page.tsx`
- Create: `src/app/planos/page.tsx`
- Test: `tests/configuracoes-planos.test.tsx`

- [x] **Step 1: Testar que as preferências alteradas persistem e que a página de planos não contém formulário de pagamento**
- [x] **Step 2: Rodar o teste e confirmar falha**
- [x] **Step 3: Implementar Configurações com tema, idioma, movimento, auto-sync e tamanho de texto**
- [x] **Step 4: Implementar Planos com três tiers, FAQ e CTA**
- [x] **Step 5: Rodar teste e commit**

### Task 7: Auditoria final e limpeza de texto

**Files:**
- Todos os arquivos de UI e `docs/superpowers/specs/2026-11-20-laudo-rapido-ui-design.md`
- Test: `corepack pnpm test`, `corepack pnpm build`

- [x] **Step 1: Revisar todo o texto com a skill unslop, removendo "(s)", redundâncias e frases vazias**
- [x] **Step 2: Rodar testes e build completos**
- [x] **Step 3: Validar no browser: troca de idioma, tema, 404, skeleton, clique otimista, planos e configurações**
- [x] **Step 4: Conferir `git status` e commit final**
