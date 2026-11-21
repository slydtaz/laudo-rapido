# Gate de produção do LaudoRápido Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o LaudoRápido na Vercel como app privado, restrito a `macedoartur1250@gmail.com`, com gate server-side, PWA atualizável, dados em tempo real e conteúdo editável sem rebuild.

**Architecture:** Mantém o cookie opaco `sessao` e a validação no banco. Um helper `exigirAcesso()` centraliza sessão + allowlist e é chamado pelo layout do grupo autenticado e por todas as APIs. Rotas públicas ficam isoladas num route group; o middleware só faz o desvio rápido. As três atualizações dinâmicas são implementadas sobre o service worker existente, polling em `/visitas` e uma API de configuração com editor em `/configuracoes`.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle + Postgres/PGlite, Zod, Vitest + Testing Library, Vercel CLI. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-21-laudo-rapido-producao-gate-design.md`

## Global Constraints

- `EMAIL_PERMITIDO=macedoartur1250@gmail.com` — somente no servidor; comparar com `trim().toLowerCase()`; se ausente, negar acesso (fail closed).
- Gate no servidor com `exigirAcesso()`; **não** trocar o cookie por JWT; **não** colocar e-mail ou regra de autorização no front-end.
- Rotas bloqueadas no Vercel: `/`, `/planos`, `/registro`, `/o/:token`, `/configuracoes`, `/conta`, `/visitas/*`, `/api/v1/auth/registro`, APIs de dados/configuração.
- Rotas públicas necessárias: `/login`, `/em-desenvolvimento`, `/offline`, `/esqueci-senha`, `/redefinir-senha`, `/verificar-email`, `/api/health`, `/api/v1/auth/login`, `/api/v1/auth/verificar`, `/api/v1/auth/verificar/reenviar`, `/api/v1/auth/senha/esqueci`, `/api/v1/auth/senha/redefinir`, `/api/v1/auth/google`, `/api/v1/auth/google/callback`, `/api/v1/auth/logout`.
- Google **e** e-mail/senha são caminhos de entrada; `/registro` permanece bloqueado.
- Rótulos PT-BR preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`.
- A vitrine de planos mantém `Nenhuma cobrança é feita nesta versão`; nenhum campo de pagamento é criado.
- Idiomas suportados em toda chave nova: `ptBR`, `en`, `es`, `fr`, `de`.
- Service worker nunca cacheia `/api/*`, `/o/*`, `/login` nem páginas HTML; nada de dado de tenant em cache.
- Polling de 30 s somente em `/visitas`, pausado com aba oculta ou offline.
- Nenhuma credencial, token ou segredo em chat, log, commit ou mensagem de erro; variáveis configuradas pelo dono na Vercel.
- Commits locais frequentes; **sem push, sem merge e sem deploy até o dono pedir explicitamente**.

## Review Focus

1. **Sessão de outro e-mail em API:** toda rota de dados deve responder `403`, não apenas as páginas — teste em Task 3.
2. **Payload local adulterado:** `assinatura: 'Paga'`, `empresaId`, `status` ou `plano` no corpo devem gerar `400` e nunca ser persistidos — teste em Task 4.
3. **Cache antigo do PWA:** uma versão anterior do SW pode servir `/` bloqueado ou chunk antigo após deploy — teste em Task 7.
4. **Loop de login:** `/login` com cookie de outro e-mail não pode mostrar o app nem redirecionar de volta para si — teste em Task 2.
5. **Configuração dinâmica hostil:** texto vazio ou com marcação em `textos`/`planos` não pode virar HTML nem quebrar o fallback do dicionário — teste em Task 9.

---

### Task 1: Allowlist e helper de acesso

**Files:**
- Create: `src/lib/auth/allowlist.ts`
- Create: `src/lib/auth/acesso.ts`
- Test: `tests/acesso.test.ts`

**Interfaces:**
- Consumes: `lerSessao(req): Promise<Sessao | null>` e `ERRO_SESSAO` de `src/lib/visita/acesso.ts`; `db` e `empresas`/`usuarios` de `src/lib/db`.
- Produces: `emailPermitido(email: string): boolean`; `type Acesso = { usuarioId: string; empresaId: string; email: string }`; `ERRO_ACESSO = { erro: 'Aplicativo em desenvolvimento.' }`; `exigirAcesso(req: Request): Promise<Acesso | null>`; `acessoOuErro(req: Request): Promise<{ acesso: Acesso } | { resposta: Response }>` (401 com `ERRO_SESSAO` para sessão inválida, 403 com `ERRO_ACESSO` para e-mail não permitido).

- [ ] **Step 1: Write the failing test** em `tests/acesso.test.ts`, usando `criarBancoTeste()`, inserção de empresa/usuário e `criarSessao()`:
  - `emailPermitido('  MACEDOARTUR1250@GMAIL.COM ')` é `true` com `process.env.EMAIL_PERMITIDO = 'macedoartur1250@gmail.com'`.
  - `emailPermitido('outro@gmail.com')` é `false`.
  - sem `EMAIL_PERMITIDO`, `exigirAcesso` devolve `null` e `acessoOuErro` devolve `403` (fail closed).
  - sessão de e-mail permitido devolve `{ usuarioId, empresaId, email }`.
  - sessão de outro e-mail devolve `403` com `ERRO_ACESSO`.
  - requisição sem cookie devolve `401` com `ERRO_SESSAO`.
  - Restaurar `process.env.EMAIL_PERMITIDO` em `afterEach`.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/acesso.test.ts`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implement** `emailPermitido` e `exigirAcesso` buscando o e-mail com `sql\`${usuarios.id}::text = ${sessao.usuarioId}\`` (a sessão guarda `usuarioId` como texto). `acessoOuErro` usa `'resposta' in resultado` como discriminante. Não logar e-mail nem valor de env.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/acesso.test.ts`
Expected: PASS (7 testes).

- [ ] **Step 5: Commit**

`git add src/lib/auth/allowlist.ts src/lib/auth/acesso.ts tests/acesso.test.ts && git commit -m "feat(auth): allowlist e helper de acesso no servidor"`

---

### Task 2: Route groups, middleware e telas de bloqueio

**Files:**
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`; `src/app/{planos,configuracoes,conta,visitas,o}` → `src/app/(app)/`
- Move: `src/app/{login,esqueci-senha,redefinir-senha,verificar-email}` → `src/app/(publico)/`
- Create: `src/app/(publico)/em-desenvolvimento/page.tsx`, `src/app/(publico)/offline/page.tsx`
- Create: `src/app/(publico)/login/FormularioLogin.tsx` (conteúdo client do atual `login/page.tsx`)
- Create: `src/app/(publico)/login/page.tsx` (server wrapper que chama `exigirAcesso`: permitido → `redirect('/visitas')`, outro e-mail → `redirect('/em-desenvolvimento')`, sem sessão → renderiza `FormularioLogin`)
- Create: `src/app/(app)/layout.tsx` (server component: `exigirAcesso` → `redirect('/em-desenvolvimento')` se nulo)
- Modify: `src/middleware.ts`, `src/app/api/v1/auth/google/callback/route.ts:77`, `src/lib/i18n/dicionario.ts` (chaves `desenvTitulo`, `desenvTexto`, `offlineTitulo`, `offlineTexto` nos 5 idiomas)
- Test: `tests/middleware.test.ts`, `tests/telas-bloqueio.test.tsx`

**Interfaces:**
- Consumes: `exigirAcesso` (Task 1).
- Produces: `ROTAS_PUBLICAS` exportado de `src/middleware.ts`; rotas `/em-desenvolvimento` e `/offline`.

- [ ] **Step 1: Write the failing tests**

Em `tests/middleware.test.ts`: trocar a lista pública para as rotas de Login/Google/senha/health/`em-desenvolvimento`/`offline`; afirmar que `/`, `/planos`, `/registro`, `/o/x`, `/visitas` sem cookie devolvem `307` com `location` contendo `/em-desenvolvimento`; que `/api/v1/visitas` sem cookie devolve `403` JSON; que rota pública continua `200`; que `__next/static` e `.png` não entram no matcher.

Em `tests/telas-bloqueio.test.tsx` (`@vitest-environment jsdom`): renderizar as duas telas com `ProvedorPreferencias` e afirmar os textos PT-BR `Aplicativo em desenvolvimento` e `Sem conexão`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/middleware.test.ts tests/telas-bloqueio.test.tsx`
Expected: FAIL — rotas ainda públicas e telas inexistentes.

- [ ] **Step 3: Implement** movendo os arquivos, criando os layouts e as telas, ajustando `ROTAS_PUBLICAS`, o destino sem cookie (página → `/em-desenvolvimento`; API → `403`), e o callback Google para `/visitas`. Adicionar as 4 chaves i18n nos 5 idiomas.

- [ ] **Step 4: Run tests and build**

Run: `corepack pnpm vitest run tests/middleware.test.ts tests/telas-bloqueio.test.tsx && corepack pnpm build`
Expected: PASS e build com 34 páginas (32 atuais + 2 novas).

- [ ] **Step 5: Commit**

`git add -A src/app middleware.ts src/lib/i18n/dicionario.ts tests/middleware.test.ts tests/telas-bloqueio.test.tsx && git commit -m "feat: gate de rotas e telas de desenvolvimento/offline"`

---

### Task 3: Todas as APIs usam o helper de acesso

**Files:**
- Modify: `src/app/api/v1/{sessao,modelos,visitas,conta}/route.ts`, `src/app/api/v1/conta/senha/route.ts`, `src/app/api/v1/visitas/sync/route.ts`, `src/app/api/v1/visitas/[id]/{pdf,assinar,fotos}/route.ts`
- Test: `tests/acesso-apis.test.ts`

**Interfaces:**
- Consumes: `acessoOuErro` (Task 1).
- Produces: todas as rotas de dados passam a usar `const resultado = await acessoOuErro(req); if ('resposta' in resultado) return resultado.resposta; const { acesso } = resultado`.

- [ ] **Step 1: Write the failing test** em `tests/acesso-apis.test.ts`: para cada `GET/POST` exportado das rotas acima, session de outro e-mail → `403` com `ERRO_ACESSO`; sem cookie → `401`; e-mail permitido → continua com o status atual da rota (usar banco de teste e mocks já existentes para storage/PDF).

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/acesso-apis.test.ts`
Expected: FAIL — rotas ainda retornam dado para outro e-mail.

- [ ] **Step 3: Implement** a troca em todas as rotas listadas, preservando o `empresaId` da sessão (`acesso.empresaId`) em vez de qualquer valor do corpo.

- [ ] **Step 4: Run the full suite**

Run: `corepack pnpm test`
Expected: PASS — suíte existente atualizada onde necessário.

- [ ] **Step 5: Commit**

`git add src/app/api tests/acesso-apis.test.ts && git commit -m "feat(api): authorization centralizada por allowlist"`

---

### Task 4: DTO rigoroso e integridade do payload local

**Files:**
- Modify: `src/lib/visita/dto.ts:9-19`
- Test: `tests/visita.test.ts`, `tests/sync.test.ts`

**Interfaces:**
- Consumes: `criarVisitaSchema` (já exportado por `src/lib/visita/service.ts`).
- Produces: nenhuma assinatura nova; apenas comportamento de validação.

- [ ] **Step 1: Write the failing tests** em `tests/visita.test.ts`:
  - `criarVisitaSchema.safeParse({ ...novaVisita(uuid), dados: { cliente:'X', tipo:'Y', observacoes:'ok', assinatura:'Paga' } }).success === false`.
  - o mesmo para campo extra no objeto raiz (`empresaId`, `status`, `plano`).
  - payload válido continua `success === true`.
  Em `tests/sync.test.ts`: enviar lote com campo extra e afirmar que nada é inserido e a rota devolve `400`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/visita.test.ts tests/sync.test.ts`
Expected: FAIL — Zod remove campos extras em vez de rejeitar.

- [ ] **Step 3: Implement** `.strict()` no objeto raiz e em `dados`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/visita.test.ts tests/sync.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "fix(dto): rejeita campos extras em visitas sincronizadas"`

---

### Task 5: Limite de tentativas de login e recuperação

**Files:**
- Create: `migrations/0004_tentativas_login.sql`
- Create: `src/lib/auth/rate-limit.ts`
- Modify: `src/lib/db/schema.ts`, `src/app/api/v1/auth/login/route.ts`, `src/app/api/v1/auth/senha/esqueci/route.ts`, `tests/migrar.test.ts`
- Test: `tests/rate-limit.test.ts`

**Interfaces:**
- Consumes: `db`, `criarBancoTeste`, `setBancoAtivo`.
- Produces: `chaveTentativa(ip: string | null, email: string): string`; `registrarTentativa(chave: string): Promise<{ bloqueado: boolean }>` (janela de 15 min, limite de 10).

- [ ] **Step 1: Write the failing test** em `tests/rate-limit.test.ts` com PGlite: 9 chamadas não bloqueiam, a 10ª devolve `bloqueado: true`, e chaves diferentes são independentes. Em `tests/auth-rotas.test.ts`: 10 login com senha errada → último `429`; `/senha/esqueci` com mesmo IP+e-mail também `429`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/rate-limit.test.ts tests/auth-rotas.test.ts`
Expected: FAIL — helper inexistente e nenhum 429.

- [ ] **Step 3: Implement** tabela `tentativas_login (chave text primary key, tentativas int, criado_em timestamp)`, UPSERT por chave com janela; ip vem de `x-forwarded-for` (primeiro valor) com fallback `'desconhecido'`. Atualizar a lista esperada em `tests/migrar.test.ts` para incluir `0004_tentativas_login.sql`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/rate-limit.test.ts tests/auth-rotas.test.ts tests/migrar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat(seguranca): limite de tentativas em login e recuperacao"`

---

### Task 6: Cabeçalhos de segurança

**Files:**
- Modify: `next.config.ts`
- Test: `tests/security-headers.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `nextConfig.headers()` com os cabeçalhos da spec; `nextConfig` permanece o export default.

- [ ] **Step 1: Write the failing test**: importar `nextConfig`, chamar `await nextConfig.headers!()` com `{}` como argumento e afirmar `Content-Security-Policy` contém `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'` e `connect-src 'self'`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`; `X-Frame-Options: SAMEORIGIN`.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/security-headers.test.ts`
Expected: FAIL — `headers` não é função.

- [ ] **Step 3: Implement** com a CSP exata da spec, incluindo `script-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob:`, `font-src 'self' data:`, `frame-src 'self' data: blob:` e os domínios de Supabase/R2 em `connect-src` (hostnames públicos, sem credenciais).

- [ ] **Step 4: Run test and build**

Run: `corepack pnpm vitest run tests/security-headers.test.ts && corepack pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat(seguranca): cabecalhos de resposta e CSP"`

---

### Task 7: Atualização do PWA sem apagar visitas locais

**Files:**
- Modify: `public/sw.js`, `src/components/RegistradorSW.tsx`, `src/lib/i18n/dicionario.ts` (chaves `pwaAtualizacao`, `pwaBotao` nos 5 idiomas)
- Test: `tests/service-worker.test.ts`, `tests/atualizacao-pwa.test.tsx`

**Interfaces:**
- Consumes: `useToast()` de `src/components/ToastProvider`.
- Produces: SW responde a `message` com `{ type: 'SKIP_WAITING' }`; `RegistradorSW` dispara toast e recarrega em `controllerchange`.

- [ ] **Step 1: Write the failing tests**

Em `tests/service-worker.test.ts`: `SHELL` não contém `/` nem página HTML; `eShell('/')` é falsa; `manipuladores.message({ data: { type: 'SKIP_WAITING' }, waitUntil })` chama `self.skipWaiting`; ativar apaga `laudo-rapido-v3-shell`.

Em `tests/atualizacao-pwa.test.tsx`: mockar `navigator.serviceWorker.register` devolvendo um registration com `installing` e disparar `updatefound` + mudança de estado; afirmar que aparece o toast `Nova versão disponível`, que clicar em `Atualizar` envia `postMessage({ type: 'SKIP_WAITING' })` e que `controllerchange` chama `location.reload` uma vez.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/service-worker.test.ts tests/atualizacao-pwa.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** SW v4 com cache só de assets e `/offline`; handler de `message`; `RegistradorSW` com `updatefound`, `statechange`, toast e `controllerchange`. Não apagar IndexedDB.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/service-worker.test.ts tests/atualizacao-pwa.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat(pwa): aviso de nova versao e cache sem paginas bloqueadas"`

---

### Task 8: Lista de visitas com atualização automática

**Files:**
- Create: `src/lib/visita/useVisitas.ts`
- Modify: `src/app/(app)/visitas/page.tsx`, `src/lib/i18n/dicionario.ts` (chave `histAtualizado` nos 5 idiomas)
- Test: `tests/historico.test.tsx`

**Interfaces:**
- Consumes: `VisitaHistorico` e `filtrarVisitas` de `src/lib/visita/filtro`.
- Produces: `useVisitas(): { visitas: VisitaHistorico[]; carregando: boolean; falhou: boolean; atualizadoEm: Date | null; recarregar: () => void }`.

- [ ] **Step 1: Write the failing test** em `tests/historico.test.tsx` com `vi.useFakeTimers()`: após render, avançar 30 s com `document.visibilityState = 'visible'` e `navigator.onLine = true` → `fetch` chamado pela 2ª vez e texto `Atualizado às` aparece; com aba oculta ou offline → nenhuma chamada; a lista antiga permanece visível durante o refresh (sem skeleton).

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/historico.test.tsx`
Expected: FAIL — hook não existe.

- [ ] **Step 3: Implement** o hook movendo `carregar`/estado do componente; `setInterval` limpo no unmount; `AbortController` por rodada;`setCarregando(true)` apenas na carga inicial e em `recarregar()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/historico.test.tsx`
Expected: PASS — rótulos PT-BR preservados.

- [ ] **Step 5: Commit**

`git commit -am "feat(visitas): atualizacao automatica a cada 30 segundos"`

---

### Task 9: API e persistência da configuração

**Files:**
- Create: `migrations/0005_configuracao_app.sql`, `src/lib/configuracao/modelo.ts`, `src/lib/configuracao/servico.ts`, `src/app/api/v1/configuracao/route.ts`
- Modify: `src/lib/db/schema.ts`, `tests/migrar.test.ts`
- Test: `tests/configuracao-dinamica.test.ts`

**Interfaces:**
- Consumes: `acessoOuErro` (Task 1); `ptBR`, `ChaveTexto` de `src/lib/i18n/dicionario`.
- Produces: `type Configuracao = { versao: number; textos: Partial<Record<ChaveTexto, string>>; planos: PlanoConfig[] }`; `PlanoConfig = { id: 'planoGratuito'|'planoPro'|'planoEquipe'|'planoEmpresas'; nome: string; preco: string; dica: string; itens: string }`; `lerConfiguracao(): Promise<Configuracao>`; `salvarConfiguracao(c: Configuracao): Promise<Configuracao>` — ambos devolvem `{ versao: 1, textos: {}, planos: [] }` quando não há registro.

- [ ] **Step 1: Write the failing tests** em `tests/configuracao-dinamica.test.ts` com banco de teste e `process.env.EMAIL_PERMITIDO` configurado:
  - `GET /api/v1/configuracao` sem sessão → `401`; com outro e-mail → `403`; com e-mail permitido e tabela vazia → `{ versao: 1, textos: {}, planos: [] }` e header `Cache-Control: no-store`.
  - `PUT` com chave de texto desconhecida → `400`; com id de plano fora dos 4 → `400`; com payload válido → `201` e `lerConfiguracao()` devolve o que foi salvo.
  - `PUT` com `<script>` em `nome` → `201`, conteúdo devolvido como texto puro (`typeof === 'string'` e igual à entrada — o escape é responsabilidade da UI na Task 10).
  - Atualizar a lista esperada em `tests/migrar.test.ts` para incluir `0005_configuracao_app.sql`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/configuracao-dinamica.test.ts tests/migrar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** tabela `configuracao_app (chave text primary key, valor jsonb not null, atualizado_em timestamp)` com uma única linha `chave = 'app'`; `configuracaoSchema` em `modelo.ts` com `superRefine` validando chaves contra `Object.keys(ptBR)` e ids de plano; `servico.ts` com `lerConfiguracao`/`salvarConfiguracao`; GET/PUT protegidos por `acessoOuErro`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/configuracao-dinamica.test.ts tests/migrar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat(config): API autenticada de textos e planos"`

---

### Task 10: Provider, tradução dinâmica e editor em configurações

**Files:**
- Create: `src/components/ProvedorConfiguracao.tsx`
- Modify: `src/lib/i18n/useT.ts`, `src/app/(app)/layout.tsx`, `src/app/(app)/planos/page.tsx`, `src/app/(app)/configuracoes/page.tsx`, `src/lib/i18n/dicionario.ts` (chaves `configConteudo`, `configTextos`, `configPlanos`, `configSalvar`, `configSalvo` nos 5 idiomas)
- Test: `tests/configuracoes-planos.test.tsx`, `tests/i18n.test.ts`

**Interfaces:**
- Consumes: `lerConfiguracao`, `salvarConfiguracao`, `Configuracao`, `PlanoConfig` (Task 9).
- Produces: `useConfiguracao(): { configuracao: Configuracao | null; salvar: (c: Configuracao) => Promise<void> }` — fora do provider devolve `null` e noop.

- [ ] **Step 1: Write the failing tests** em `tests/i18n.test.ts`: `useT` com `ProvedorConfiguracao` e override devolve o texto alterado; sem provider devolve o dicionário local; se o fetch falhar, devolve o dicionário. Em `tests/configuracoes-planos.test.tsx`: o editor altera um texto, clica `Salvar` e o `fetch` PUT é chamado com o payload; `/planos` mostra o nome do plano vindo do provider e mantém `Nenhuma cobrança é feita nesta versão`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/configuracoes-planos.test.tsx tests/i18n.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** `ProvedorConfiguracao` buscando no mount e expondo `salvar`; `useT` consultando override antes do dicionário; montar provider em `(app)/layout.tsx`; `/planos` usando `configuracao.planos` com fallback para os 4 planos atuais; seção “Conteúdo” em `/configuracoes` com campos de texto por idioma e plano e botão `Salvar`. Toda renderização via React — nenhum `dangerouslySetInnerHTML`.

- [ ] **Step 4: Run tests and build**

Run: `corepack pnpm vitest run tests/configuracoes-planos.test.tsx tests/i18n.test.ts && corepack pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

`git commit -am "feat(config): editor de conteudo e traducao dinamica"`

---

### Task 11: Verificação final, checklist de deploy e relatório

**Files:**
- Create: `docs/deploy-vercel.md`
- Modify: `docs/superpowers/reports/2026-11-21-laudo-rapido-auditoria-seguranca.md`
- Test: nenhum novo; executar a suíte completa.

**Interfaces:**
- Consumes: tudo.

- [ ] **Step 1: Run full verification**

Run: `corepack pnpm test && corepack pnpm build`
Expected: 50+ arquivos de teste PASS; build exit 0 com 34 páginas.

- [ ] **Step 2: Smoke manual no preview** com os rótulos `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF` e o fluxo de bloqueio de outro e-mail.

- [ ] **Step 3: Write `docs/deploy-vercel.md`** com, e somente com, nomes de variáveis e passos: `DATABASE_URL`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI = https://<dominio>/api/v1/auth/google/callback`, `EMAIL_WEBHOOK_URL`, `EMAIL_PERMITIDO=macedoartur1250@gmail.com`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_PUBLIC_BASE`, `R2_REGION`, `R2_FORCE_PATH_STYLE`. Incluir: `vercel login`, `vercel link`, migração com `corepack pnpm tsx -e "process.loadEnvFile('.env.local'); void import('./scripts/migrar.ts')"`, `vercel --prod`, verificações com `curl` e `vercel rollback`. Nenhum valor secreto no arquivo.

- [ ] **Step 4: Update the audit report** com o estado de A1, A2, A3, M1–M4, B1 e I1–I2 após as correções, com evidência dos testes que cobrem cada um.

- [ ] **Step 5: Commit**

`git commit -am "docs: checklist de deploy e auditoria final"`

**Não incluído nesta tarefa:** `vercel --prod`. O deploy só acontece após confirmação explícita do dono e com as variáveis configuradas por ele.
