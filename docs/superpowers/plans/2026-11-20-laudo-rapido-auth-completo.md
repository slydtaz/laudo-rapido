# Login completo e OAuth com Google — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar cadastro, verificação de e-mail, recuperação de senha, perfil e login com Google (com modo demo) preservando o cookie `sessao`, o offline-first e os cinco idiomas.

**Architecture:** Mantemos o modelo de sessão próprio: todo fluxo termina em `criarSessao()` e no mesmo cookie HttpOnly. O Google entra via Authorization Code + PKCE, com validação de `id_token` por JWKS; o modo demo exercita state/PKCE e substitui só a validação do token por um perfil sintético. Tokens de e-mail são armazenados como hash SHA-256 e consumidos uma vez.

**Tech Stack:** Next.js 15 App Router, Drizzle ORM + postgres-js/PGlite, Argon2, Zod, Node `crypto`, Vitest + Testing Library, Tailwind classes existentes.

**Spec:** `docs/superpowers/specs/2026-11-20-laudo-rapido-auth-completo-design.md`

## Global Constraints

- Branch `feature/laudo-rapido-mvp`, base `d237b45`. Commits locais; **sem push, merge ou deploy**.
- **Nunca ler, imprimir ou commitar `.env.local`.** Variáveis são lidas por `process.env` no servidor.
- Rótulos PT-BR preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`.
- Cinco idiomas em `src/lib/i18n/dicionario.ts`; `ptBR` é `as const` e os outros quatro dicionários são `DicionarioTextos`, então toda chave nova deve existir nos cinco.
- Sem dependências novas. JWKS com `fetch` + `node:crypto` (`createPublicKey`, `verify`).
- Middleware roda no Edge: apenas literais de rota, nenhuma importação de `db`.
- Cookie `sessao`: `HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`, com `Secure` só em produção.
- Modo demo apenas quando `NODE_ENV !== 'production'`.
- TDD: todo serviço novo começa com teste vermelho. Build só com dev server parado e `.next` limpo.

## Review Focus

1. **Google callback com `state` ausente/diferente do cookie** → deve responder 400 e não criar sessão nem usuário. Teste em Task 7, `tests/google-rota.test.ts`.
2. **Token de redefinição reutilizado, expirado ou de tipo errado** → deve ser recusado sem alterar a senha. Testes em Task 1 (`tests/tokens.test.ts`) e Task 4 (`tests/auth-rotas.test.ts`).
3. **Conta local com e-mail não verificado encontrada por login Google verificado** → não vincular, não marcar como verificada, devolver `CONTA_LOCAL_NAO_VERIFICADA`. Teste em Task 7, `tests/google.test.ts`.
4. **Esqueci-minha-senha para e-mail inexistente** → resposta `202` byte a byte igual à de e-mail existente, sem enumeração. Teste em Task 4, `tests/auth-rotas.test.ts`.
5. **Modo demo com `NODE_ENV=production`** → `503` na rota inicial e nenhuma tela de consentimento falsa. Teste em Task 7, `tests/google-rota.test.ts`.

---

### Task 1: Migração 0003 e tokens de uso único

**Files:**
- Create: `migrations/0003_auth.sql`
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/auth/tokens.ts`
- Test: `tests/tokens.test.ts`

**Interfaces:**
- Consumes: `db` e `criarBancoTeste()` de `src/lib/db/client.ts`.
- Produces:
```ts
export type TipoToken = 'verificar_email' | 'redefinir_senha'
export const VALIDADE_TOKEN_SEGUNDOS: Record<TipoToken, number> // 86400 / 1800
export const COOLDOWN_TOKEN_SEGUNDOS = 60
export function gerarToken(): string                       // 32 bytes base64url
export function hashToken(token: string): string            // sha256 hex
export async function criarToken(usuarioId: string, tipo: TipoToken): Promise<string>
export async function consumirToken(token: string, tipo: TipoToken): Promise<string | null>
export async function podeEmitirToken(usuarioId: string, tipo: TipoToken): Promise<boolean>
```

- [ ] **Step 1: escrever o teste vermelho**

`tests/tokens.test.ts`, com `setBancoAtivo(await criarBancoTeste())` e `afterEach(() => setBancoAtivo(undefined))`. Inserir um usuário real (`empresas` + `usuarios`) para obter `usuarioId` UUID. Assertions: `gerarToken()` tem 43 caracteres base64url; `hashToken(token) !== token`; `criarToken` grava `id = hashToken(token)` e não o token bruto; `consumirToken(token, tipo)` devolve o `usuarioId` uma vez e `null` na segunda; token com `tipo` diferente é recusado; token com `expira_em` no passado é recusado; `podeEmitirToken` é `false` logo após `criarToken` e `true` depois de antedatar `criado_em` em 61 s via update direto na tabela.

- [ ] **Step 2: rodar o teste e confirmar que falha**

Run: `corepack pnpm vitest run tests/tokens.test.ts`
Expected: FAIL com `Cannot find module '../src/lib/auth/tokens'`.

- [ ] **Step 3: implementar a migração e o schema**

`migrations/0003_auth.sql`: adicionar `nome text`, `google_sub text`, `email_verificado_em timestamp` em `usuarios`; `CREATE UNIQUE INDEX "usuarios_google_sub_unique" ON "usuarios" ("google_sub")`; criar `tokens_auth` com `id text PRIMARY KEY`, `usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE`, `tipo text NOT NULL CHECK (tipo IN ('verificar_email','redefinir_senha'))`, `expira_em timestamp NOT NULL`, `usado_em timestamp`, `criado_em timestamp NOT NULL DEFAULT now()`. Espelhar em `src/lib/db/schema.ts` (`tokensAuth`) e exportar `TokenAuth` type.

- [ ] **Step 4: implementar `src/lib/auth/tokens.ts`**

`consumirToken` usa `db.update(...).set({ usadoEm: new Date() }).where(and(eq(id, hash), eq(tipo, tipo), isNull(usadoEm), gt(expiraEm, new Date()))).returning({ usuarioId })` e devolve `null` quando não houver linha. `podeEmitirToken` consulta o último token do par e compara `criadoEm` com `COOLDOWN_TOKEN_SEGUNDOS`.

- [ ] **Step 5: rodar o teste e confirmar que passa**

Run: `corepack pnpm vitest run tests/tokens.test.ts`
Expected: PASS.

- [ ] **Step 6: commit**

`git add migrations/0003_auth.sql src/lib/db/schema.ts src/lib/auth/tokens.ts tests/tokens.test.ts && git commit -m "feat(auth): migracao e tokens de uso unico"`

---

### Task 2: Helper de cookies de sessão e OAuth

**Files:**
- Create: `src/lib/auth/cookie.ts`
- Modify: `src/app/api/v1/auth/login/route.ts`
- Modify: `src/app/api/v1/auth/logout/route.ts`
- Test: `tests/cookie.test.ts`

**Interfaces:**
- Consumes: `COOKIE_SESSAO`, `DURACAO_SESSAO_SEGUNDOS` de `src/lib/auth/session.ts`.
- Produces:
```ts
export const COOKIE_OAUTH = 'oauth'
export const DURACAO_COOKIE_OAUTH_SEGUNDOS = 600
export function definirCookieSessao(token: string): string
export function cookieSessaoExpirado(): string
export function definirCookieOAuth(valor: { state: string; verifier: string }): string
export function lerCookieOAuth(req: Request): { state: string; verifier: string } | null
export function cookieOAuthExpirado(): string
```

- [ ] **Step 1: escrever o teste vermelho**

`tests/cookie.test.ts`: `definirCookieSessao('abc')` contém `sessao=abc`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=604800`; com `NODE_ENV='production'` contém `Secure`, com `'test'` não contém (restaurar `NODE_ENV` no `afterEach`); `cookieSessaoExpirado()` contém `Max-Age=0`; `definirCookieOAuth({state:'s',verifier:'v'})` → `lerCookieOAuth` devolve os valores via `new Request('http://localhost/', { headers: { cookie: valor.split(';')[0] } })`; cookie inválido devolve `null`.

- [ ] **Step 2: rodar o teste e confirmar que falha**

Run: `corepack pnpm vitest run tests/cookie.test.ts`
Expected: FAIL com `Cannot find module '../src/lib/auth/cookie'`.

- [ ] **Step 3: implementar `src/lib/auth/cookie.ts`**

Serializar OAuth como `JSON.stringify` em base64url. Todos os cookies com `HttpOnly; SameSite=Lax; Path=/`; `Secure` quando `process.env.NODE_ENV === 'production'`.

- [ ] **Step 4: refatorar login e logout para usar os helpers**

Substituir a montagem manual de `Set-Cookie` em `src/app/api/v1/auth/login/route.ts` e `src/app/api/v1/auth/logout/route.ts` por `definirCookieSessao(token)` e `cookieSessaoExpirado()`. Preservar statuses e corpos atuais.

- [ ] **Step 5: rodar testes de cookie e de login/logout**

Run: `corepack pnpm vitest run tests/cookie.test.ts tests/logout.test.ts tests/auth.test.ts`
Expected: PASS nos três arquivos.

- [ ] **Step 6: commit**

`git add src/lib/auth/cookie.ts src/app/api/v1/auth/login/route.ts src/app/api/v1/auth/logout/route.ts tests/cookie.test.ts && git commit -m "refactor(auth): unificar cookies de sessao e oauth"`

---

### Task 3: Remetente de links de e-mail

**Files:**
- Create: `src/lib/auth/email.ts`
- Test: `tests/email.test.ts`

**Interfaces:**
- Consumes: `TipoToken` (Task 1).
- Produces:
```ts
export type LinkEmail = { tipo: TipoToken; token: string; email: string }
export type ResultadoEnvio =
  | { modo: 'demo'; link: string; token: string }
  | { modo: 'webhook' }
  | { modo: 'silencioso' }
export function montarLink(tipo: TipoToken, token: string): string
export async function enviarLink(link: LinkEmail): Promise<ResultadoEnvio>
```

- [ ] **Step 1: escrever o teste vermelho**

`tests/email.test.ts`: `montarLink('verificar_email','t') === '/verificar-email?token=t'` e `montarLink('redefinir_senha','t') === '/redefinir-senha?token=t'`; com `NODE_ENV='test'` e sem `EMAIL_WEBHOOK_URL`, `enviarLink` devolve `{ modo:'demo', link, token }`; com `EMAIL_WEBHOOK_URL` apontando para um `fetch` mockado, devolve `{ modo:'webhook' }` e o corpo enviado contém `para`, `assunto`, `link` e **não** contém o token; com `NODE_ENV='production'` sem webhook, devolve `{ modo:'silencioso' }`. Restaurar env e mock no `afterEach`.

- [ ] **Step 2: rodar o teste e confirmar que falha**

Run: `corepack pnpm vitest run tests/email.test.ts`
Expected: FAIL com `Cannot find module '../src/lib/auth/email'`.

- [ ] **Step 3: implementar `src/lib/auth/email.ts`**

Nunca registrar token em log. No modo webhook, `fetch(EMAIL_WEBHOOK_URL, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ para, assunto, link }) })`; se o fetch falhar, devolver `{ modo:'silencioso' }` sem lançar para o chamador.

- [ ] **Step 4: rodar o teste e confirmar que passa**

Run: `corepack pnpm vitest run tests/email.test.ts`
Expected: PASS.

- [ ] **Step 5: commit**

`git add src/lib/auth/email.ts tests/email.test.ts && git commit -m "feat(auth): remetente de links com modo demo"`

---

### Task 4: Registro, verificação e recuperação de senha

**Files:**
- Create: `src/lib/auth/conta.ts`
- Create: `src/app/api/v1/auth/registro/route.ts`
- Create: `src/app/api/v1/auth/verificar/route.ts`
- Create: `src/app/api/v1/auth/verificar/reenviar/route.ts`
- Create: `src/app/api/v1/auth/senha/esqueci/route.ts`
- Create: `src/app/api/v1/auth/senha/redefinir/route.ts`
- Modify: `src/middleware.ts`
- Test: `tests/conta.test.ts`, `tests/auth-rotas.test.ts`

**Interfaces:**
- Consumes: `criarToken`, `consumirToken`, `podeEmitirToken` (Task 1); `enviarLink`, `montarLink` (Task 3); `hashSenha`, `verificarSenha`.
- Produces:
```ts
export type ResultadoOk = { ok: true; usuarioId: string }
export type ResultadoErro = { ok: false; erro: string }
export async function criarContaComSenha(input: { nome: string; empresa: string; email: string; senha: string }): Promise<ResultadoOk | ResultadoErro>
export async function verificarEmail(token: string): Promise<{ ok: true } | { ok: false; erro: string }>
export async function reenviarVerificacao(email: string): Promise<void>
export async function solicitarRedefinicao(email: string): Promise<void>
export async function redefinirSenha(token: string, senhaNova: string): Promise<{ ok: true } | { ok: false; erro: string }>
```

- [ ] **Step 1: escrever os testes vermelhos**

`tests/conta.test.ts`: e-mail normalizado (`'  Usuario@Exemplo.com '` → `usuario@exemplo.com`); senha com menos de 8 caracteres devolve erro; conta duplicada devolve `'E-mail já cadastrado.'` e não cria segunda empresa; conta nova cria `empresas`, `usuarios` com `senhaHash` e `emailVerificadoEm` nulo; `verificarEmail` preenche `emailVerificadoEm` e recusa token já usado; `redefinirSenha` troca o hash, recusa token usado e apaga todas as sessões do usuário; `solicitarRedefinicao` para e-mail inexistente não lança nem cria token.

`tests/auth-rotas.test.ts`: importar `POST` das cinco rotas e chamá-las com `new Request(..., { method:'POST', body: JSON.stringify(...) })`; conferir 201 no registro, 200 em verificar/redefinir, 400 em token inválido, e 202 com corpo idêntico em `/senha/esqueci` para e-mail existente e inexistente.

- [ ] **Step 2: rodar os testes e confirmar que falham**

Run: `corepack pnpm vitest run tests/conta.test.ts tests/auth-rotas.test.ts`
Expected: FAIL com `Cannot find module '../src/lib/auth/conta'`.

- [ ] **Step 3: implementar `src/lib/auth/conta.ts`**

Usar `db.transaction` para criar empresa + usuário. Normalizar e-mail com `trim().toLowerCase()`. Zod nos inputs das rotas (não no serviço). Em `redefinirSenha`, após `consumirToken`, atualizar hash e `db.delete(sessoes).where(eq(sessoes.usuarioId, usuarioId))`.

- [ ] **Step 4: implementar as cinco rotas**

Corpos de erro genéricos. Respostas de registro/verificação/redefinição incluem `link` e `token` somente quando `enviarLink` devolver `{ modo:'demo' }`. Rotas sempre fecham com o mesmo formato `{ ok, ... }`.

- [ ] **Step 5: atualizar o middleware**

Adicionar a `ROTAS_PUBLICAS`: `/registro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`, `/api/v1/auth/registro`, `/api/v1/auth/verificar`, `/api/v1/auth/senha`, `/api/v1/auth/google`.

- [ ] **Step 6: rodar os testes e confirmar que passam**

Run: `corepack pnpm vitest run tests/conta.test.ts tests/auth-rotas.test.ts tests/tokens.test.ts tests/email.test.ts`
Expected: PASS em todos.

- [ ] **Step 7: commit**

`git add src/lib/auth/conta.ts src/app/api/v1/auth src/middleware.ts tests/conta.test.ts tests/auth-rotas.test.ts && git commit -m "feat(auth): registro, verificacao e recuperacao de senha"`

---

### Task 5: Telas de registro, verificação e recuperação

**Files:**
- Create: `src/app/registro/page.tsx`
- Create: `src/app/verificar-email/page.tsx`
- Create: `src/app/esqueci-senha/page.tsx`
- Create: `src/app/redefinir-senha/page.tsx`
- Modify: `src/lib/i18n/dicionario.ts`
- Test: `tests/telas-auth.test.tsx`

**Interfaces:**
- Consumes: rotas da Task 4; `useT`, `useToast`, `executarOtimista`.
- Produces: nenhuma interface nova; apenas rotas de página.

- [ ] **Step 1: escrever o teste vermelho**

`tests/telas-auth.test.tsx`: seguir o padrão dos testes de componente existentes, com `vi.mock('next/navigation')`, `vi.mock('@/components/ToastProvider')` e `fetch` mockado. Assertions: `/registro` renderiza os rótulos de nome, empresa, e-mail, senha e o link para `/login`; submeter chama `POST /api/v1/auth/registro` com o corpo normalizado; `/esqueci-senha` mostra a resposta genérica; `/verificar-email` e `/redefinir-senha` chamam a rota correta com o token vindo da query string.

- [ ] **Step 2: rodar o teste e confirmar que falha**

Run: `corepack pnpm vitest run tests/telas-auth.test.tsx`
Expected: FAIL com `Cannot find module '../src/app/registro/page'`.

- [ ] **Step 3: adicionar as chaves nos cinco idiomas**

Em `ptBR`, adicionar chaves `registro*`, `verificar*`, `esqueci*`, `redefinir*`; replicar em `en`, `es`, `fr`, `de` mantendo `DicionarioTextos`. Nenhuma chave existente pode mudar de valor.

- [ ] **Step 4: implementar as quatro páginas**

Usar `card`, `label`, `input`, `btn`, `link` e `min-h-11`. Para ler o token da URL, usar `new URLSearchParams(window.location.search).get('token')` dentro de `useEffect` — não `useSearchParams`, para não exigir Suspense em build estático. Verificação dispara ao montar quando houver token; redefinição usa formulário.

- [ ] **Step 5: rodar o teste e a suíte de i18n**

Run: `corepack pnpm vitest run tests/telas-auth.test.tsx tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: commit**

`git add src/app/registro src/app/verificar-email src/app/esqueci-senha src/app/redefinir-senha src/lib/i18n/dicionario.ts tests/telas-auth.test.tsx && git commit -m "feat(auth): telas de registro e recuperacao"`

---

### Task 6: Perfil e troca de senha

**Files:**
- Modify: `src/lib/auth/conta.ts`
- Create: `src/app/api/v1/conta/route.ts`
- Create: `src/app/api/v1/conta/senha/route.ts`
- Create: `src/app/conta/page.tsx`
- Modify: `src/app/configuracoes/page.tsx`
- Modify: `src/lib/i18n/dicionario.ts`
- Test: `tests/perfil.test.ts`, `tests/conta-tela.test.tsx`

**Interfaces:**
- Consumes: `lerSessao`, `extrairTokenCookie` (já existentes em `session.ts`); `verificarSenha`, `hashSenha`.
- Produces:
```ts
export type Perfil = {
  nome: string; email: string; empresa: string
  verificado: boolean; provedor: 'senha' | 'google'; criadoEm: string
}
export async function lerPerfil(usuarioId: string): Promise<Perfil | null>
export async function atualizarNome(usuarioId: string, nome: string, empresa: string): Promise<void>
export async function trocarSenha(
  usuarioId: string, senhaAtual: string | null, senhaNova: string, tokenAtual: string | null,
): Promise<{ ok: true } | { ok: false; erro: string }>
```

- [ ] **Step 1: escrever os testes vermelhos**

`tests/perfil.test.ts`: `lerPerfil` devolve os campos sem `senhaHash`/`googleSub`; `atualizarNome` altera `usuarios.nome` e `empresas.nome`; conta com senha exige `senhaAtual` correta e recusa errada; conta sem senha (Google) exige `emailVerificadoEm` preenchido; troca bem-sucedida apaga as outras sessões mas mantém `tokenAtual`.

`tests/conta-tela.test.tsx`: renderiza e-mail, empresa, status de verificação, formulário de nome e formulário de senha; confirma que `/configuracoes` contém link para `/conta`.

- [ ] **Step 2: rodar os testes e confirmar que falham**

Run: `corepack pnpm vitest run tests/perfil.test.ts tests/conta-tela.test.tsx`
Expected: FAIL com `Cannot find module '../src/app/api/v1/conta/route'`.

- [ ] **Step 3: implementar os serviços em `conta.ts`**

`provedor = senhaHash ? 'senha' : 'google'`. `trocarSenha` usa `db.delete(sessoes).where(and(eq(usuarioId, usuarioId), ne(sessoes.id, tokenAtual ?? '')))`.

- [ ] **Step 4: implementar as rotas e a tela**

`GET/PATCH /api/v1/conta` e `POST /api/v1/conta/senha` derivam `usuarioId` de `lerSessao(req)` — nunca do corpo. Respostas: 401 sem sessão, 200/400 nos demais casos. Adicionar link "Minha conta" em `/configuracoes` e chaves `conta*` nos cinco idiomas.

- [ ] **Step 5: rodar os testes e confirmar que passam**

Run: `corepack pnpm vitest run tests/perfil.test.ts tests/conta-tela.test.tsx tests/logout.test.ts`
Expected: PASS.

- [ ] **Step 6: commit**

`git add src/lib/auth/conta.ts src/app/api/v1/conta src/app/conta src/app/configuracoes src/lib/i18n/dicionario.ts tests/perfil.test.ts tests/conta-tela.test.tsx && git commit -m "feat(conta): perfil e troca de senha"`

---

### Task 7: Google OAuth com PKCE, callback e modo demo

**Files:**
- Modify: `src/lib/auth/conta.ts`
- Create: `src/lib/auth/google.ts`
- Create: `src/app/api/v1/auth/google/route.ts`
- Create: `src/app/api/v1/auth/google/callback/route.ts`
- Create: `src/app/api/v1/auth/google/demo/route.ts`
- Modify: `src/middleware.ts`
- Test: `tests/google.test.ts`, `tests/google-rota.test.ts`

**Interfaces:**
- Consumes: `definirCookieOAuth`, `lerCookieOAuth`, `cookieOAuthExpirado`, `definirCookieSessao` (Task 2); `Perfil` e serviços de `conta.ts`.
- Produces:
```ts
export type PerfilGoogle = { sub: string; email: string; emailVerificado: boolean; nome: string }
export type ConfigGoogle = { clientId: string; clientSecret: string; redirectUri: string }
export function configuracaoGoogle(): ConfigGoogle | null
export function modoDemo(): boolean
export function criarFluxoOAuth(cfg: ConfigGoogle | null): { state: string; verifier: string; url: string }
export async function trocarCodigo(code: string, verifier: string, cfg: ConfigGoogle): Promise<{ idToken: string }>
export async function validarIdToken(idToken: string, cfg: ConfigGoogle): Promise<PerfilGoogle | null>
export function perfilDemo(): PerfilGoogle
export async function vincularOuCriarGoogle(perfil: PerfilGoogle): Promise<
  { ok: true; usuarioId: string } | { ok: false; erro: string; codigo: 'EMAIL_NAO_VERIFICADO' | 'CONTA_LOCAL_NAO_VERIFICADA' | 'SUB_DIVERGENTE' }
>
```

- [ ] **Step 1: escrever os testes vermelhos**

`tests/google.test.ts`: `criarFluxoOAuth(null)` devolve URL relativa `/api/v1/auth/google/demo`; com cfg, URL contém `accounts.google.com`, `code_challenge_method=S256`, `state` e `redirect_uri`; `validarIdToken` com `fetch` mockado devolve perfil para JWKS com chave válida e `null` para `aud` errado, `iss` errado, `exp` passado, `email_verified:false` e assinatura inválida; `perfilDemo()` devolve `demo.google@exemplo.local`, sub `google-demo-sub`, `emailVerificado: true`; `vincularOuCriarGoogle` cria empresa `"Minha empresa"` + usuário sem senha com `emailVerificadoEm` preenchido; vincula a conta existente verificada sem tocar no `senhaHash`; recusa conta local não verificada com `CONTA_LOCAL_NAO_VERIFICADA`; recusa `sub` divergente com `SUB_DIVERGENTE`.

`tests/google-rota.test.ts`: `GET /api/v1/auth/google` sem cfg em `NODE_ENV='test'` redireciona 307 para `/api/v1/auth/google/demo` e define cookie `oauth`; com `NODE_ENV='production'` sem cfg responde 503; callback com `state` ausente ou divergente do cookie responde 400 e não cria sessão; callback com `code=demo-code` e state válido cria sessão, define cookie `sessao` e redireciona 303 para `/`; callback com conta local não verificada redireciona 303 para `/login?erro=CONTA_LOCAL_NAO_VERIFICADA` sem cookie de sessão.

- [ ] **Step 2: rodar os testes e confirmar que falham**

Run: `corepack pnpm vitest run tests/google.test.ts tests/google-rota.test.ts`
Expected: FAIL com `Cannot find module '../src/lib/auth/google'`.

- [ ] **Step 3: implementar `src/lib/auth/google.ts`**

`randomBytes(32).toString('base64url')` para state e verifier; `code_challenge = createHash('sha256').update(verifier).digest('base64url')`. JWKS com cache em memória de 5 min. Verificar RS256 com `createPublicKey({ key: jwk, format: 'jwk' })` e `verify('RSA-SHA256', Buffer.from(`${header}.${payload}`), key, sig)`, após conferir `alg === 'RS256'`. Claims: `iss` estritamente `https://accounts.google.com`, `aud === cfg.clientId`, `exp > now`, `email_verified === true`, `email` e `sub` presentes.

- [ ] **Step 4: implementar `vincularOuCriarGoogle` em `conta.ts`**

Normalizar e-mail. Se não houver usuário: criar empresa + usuário com `senhaHash: null`, `googleSub`, `nome`, `emailVerificadoEm: new Date()`. Se houver: exigir `perfil.emailVerificado` e `usuario.emailVerificadoEm`; se `usuario.googleSub` existir e for diferente, devolver `SUB_DIVERGENTE`; preencher `googleSub`/`nome` sem alterar senha.

- [ ] **Step 5: implementar as três rotas**

`google/route.ts`: gerar fluxo, gravar cookie OAuth, redirecionar para `url`. `demo/route.ts`: HTML com aviso "Modo demo — não é o Google" e formulário GET para o callback com `code=demo-code` e `state` lido do cookie; ausência de cookie → 400. `callback/route.ts`: validar `state`, limpar cookie OAuth, obter perfil (demo ou real), chamar `vincularOuCriarGoogle`, definir cookie de sessão e redirecionar.

- [ ] **Step 6: rodar os testes e confirmar que passam**

Run: `corepack pnpm vitest run tests/google.test.ts tests/google-rota.test.ts tests/perfil.test.ts`
Expected: PASS.

- [ ] **Step 7: commit**

`git add src/lib/auth/google.ts src/lib/auth/conta.ts src/app/api/v1/auth/google tests/google.test.ts tests/google-rota.test.ts && git commit -m "feat(auth): OAuth com Google via PKCE e modo demo"`

---

### Task 8: Botão "Continuar com Google" e documentação de setup

**Files:**
- Create: `src/components/BotaoGoogle.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/registro/page.tsx`
- Modify: `src/lib/i18n/dicionario.ts`
- Create: `docs/auth-google.md`
- Test: `tests/botao-google.test.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/auth/google` (Task 7).
- Produces: componente `BotaoGoogle` com props `{ rotulo?: string }`.

- [ ] **Step 1: escrever o teste vermelho**

`tests/botao-google.test.tsx`: renderiza link/botão com rótulo "Continuar com Google", `href="/api/v1/auth/google"`, ícone com `aria-hidden`, e altura mínima 44 px conferida por classe `min-h-11`. Assertions de presença em `/login` e `/registro`.

- [ ] **Step 2: rodar o teste e confirmar que falha**

Run: `corepack pnpm vitest run tests/botao-google.test.tsx`
Expected: FAIL com `Cannot find module '../src/components/BotaoGoogle'`.

- [ ] **Step 3: implementar componente, botões e chaves i18n**

SVG inline do "G" (sem asset externo). Adicionar divisor "ou" e o botão abaixo do formulário em `/login` e `/registro`. Chaves `googleContinuar`, `googleOu`, `googleDemoAviso` nos cinco idiomas.

- [ ] **Step 4: escrever `docs/auth-google.md`**

Listar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (padrão `http://localhost:3000/api/v1/auth/google/callback`) e `EMAIL_WEBHOOK_URL`; passo de autorizar a redirect URI no Google Cloud Console; comportamento do modo demo; aviso de que nenhum valor deve ser commitado. Sem valores reais de credenciais.

- [ ] **Step 5: rodar o teste e a suíte de i18n**

Run: `corepack pnpm vitest run tests/botao-google.test.tsx tests/i18n.test.ts`
Expected: PASS.

- [ ] **Step 6: commit**

`git add src/components/BotaoGoogle.tsx src/app/login src/app/registro src/lib/i18n/dicionario.ts docs/auth-google.md tests/botao-google.test.tsx && git commit -m "feat(auth): botao Google e guia de configuracao"`

---

### Task 9: Auditoria final

**Files:**
- Create: `docs/superpowers/reports/2026-11-20-laudo-rapido-auth-relatorio.md`
- Modify: `.superpowers/sdd/2026-11-20-laudo-rapido-auth/progress.md` (ledger local, sem commit)

**Interfaces:**
- Consumes: todas as anteriores.

- [ ] **Step 1: rodar a suíte completa**

Run: `corepack pnpm test`
Expected: PASS, sem testes pulados.

- [ ] **Step 2: aplicar a migração no banco de desenvolvimento e rodar o build**

Parar qualquer dev server na porta 3000, remover `.next`, rodar `corepack pnpm db:migrate` e `corepack pnpm build`. Expected: migração idempotente e build com todas as rotas novas listadas.

- [ ] **Step 3: subir o servidor de produção e validar no browser**

`corepack pnpm start` destacado. Fluxos: registro → verificação (link demo) → login → `/conta` → trocar senha → logout; esqueci senha → redefinir (link demo) → login com nova senha; login → botão Google → consentimento demo → sessão criada; tentativa de vínculo com conta local não verificada. Confirmar que nenhuma credencial aparece em log.

- [ ] **Step 4: auditoria visual**

Capturas em 375/768/1280/1440 × claro/escuro nas seis páginas novas; zero overflow horizontal, alvos ≥44 px, sem erros de console além do 401 esperado da home sem cookie.

- [ ] **Step 5: escrever o relatório, atualizar o ledger e commitar**

Registrar evidências, hashes dos commits e observações. `git add docs/superpowers/reports/2026-11-20-laudo-rapido-auth-relatorio.md && git commit -m "docs: relatorio de auditoria do login completo"`. Sem push, merge ou deploy.
