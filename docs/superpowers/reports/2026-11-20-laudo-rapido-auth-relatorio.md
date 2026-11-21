# Relatório de auditoria — Login completo e OAuth com Google

**Data:** 2026-11-20
**Branch:** `feature/laudo-rapido-mvp`
**Plano:** `docs/superpowers/plans/2026-11-20-laudo-rapido-auth-completo.md`
**Spec de autoridade:** `docs/superpowers/specs/2026-11-20-laudo-rapido-auth-completo-design.md`
**Resultado:** aprovado. Nada foi pushado, mergeado ou deployado.

## 1. Escopo entregue

- Cadastro de conta com empresa, e-mail e senha (Argon2).
- Verificação de e-mail por token opaco de uso único (SHA-256 no banco).
- Recuperação de senha com resposta `202` idêntica para e-mail existente ou inexistente.
- Perfil e troca de senha com invalidação das outras sessões.
- Login com Google via Authorization Code + PKCE, validação RS256/JWKS e modo demo.
- Caixa de entrada demo de links, dev-only, sem aceitar e-mail como parâmetro.
- Vitrine de planos estática com aviso `Nenhuma cobrança é feita nesta versão`.

Preservados: cookie `sessao` HttpOnly/SameSite=Lax, PWA/offline-first, rotas atuais, rótulos PT-BR de smoke, cinco idiomas e tema claro/escuro/sistema.

## 2. Evidências de verificação

### 2.1 Suíte automatizada

```
corepack pnpm test
 Test Files  37 passed (37)
      Tests  138 passed (138)
   Duration  53.96s
```

Nenhum teste pulado. A suíte cobre os cinco Review Focus do plano: `state` do OAuth, token reutilizado/expirado/tipo errado, conta local não verificada, não enumeração de e-mail e demo indisponível em produção.

### 2.2 Migração e build

- Migração `0003_auth.sql` aplicada ao banco de desenvolvimento com sucesso (NOTICE `42P07` esperado: tabela de ledger de migrações já existia). O comando nu `corepack pnpm db:migrate` exige `.env.local` carregado no processo; foi usado o wrapper `process.loadEnvFile('.env.local')` sem imprimir nenhuma variável.
- `corepack pnpm build`: compilação, type-check e geração de 32 páginas concluídos. Todas as rotas de autenticação aparecem no mapa de build.

Correções de type-check encontradas na auditoria e fechadas com teste prévio (RED → GREEN):

| Arquivo | Falha | Correção |
| --- | --- | --- |
| `src/lib/auth/conta.ts` | `usuario.email` não existia no `.select({ id })` do reenvio | passou a selecionar `email: usuarios.email` |
| `src/lib/auth/google.ts` | `kid` não existe no tipo DOM `JsonWebKey` | tipo `ChaveJwk = JsonWebKey & { kid?; use?; alg? }` |
| `src/lib/auth/email.ts` | caixa demo duplicada entre bundles de route handlers em dev | buffer movido para `globalThis` |
| `src/app/verificar-email/page.tsx` | StrictMode consumia o token de uso único duas vezes | guard `useRef` no efeito de verificação |

### 2.3 E2E em `corepack pnpm dev`

Fluxos executados no browser real contra o banco de desenvolvimento:

1. **Registro → verificação → login → perfil → troca de senha → logout**
   - Conta `e2e-…@exemplo.local` criada (201) com link demo devolvido na resposta.
   - Link de verificação aberto: `E-mail verificado. Você já pode entrar.`
   - Login com a senha inicial: redirecionou para `/` com `Registrar nova visita`.
   - `/conta` exibiu nome, empresa, `E-mail verificado`, `Acesso com senha`.
   - Nome/empresa e senha atualizados; após logout, a senha nova entrou com sucesso.
2. **Esqueci minha senha → redefinir → login com a nova senha**
   - `POST /api/v1/auth/senha/esqueci` → `202` e link visível em `/api/v1/auth/demo-links`.
   - `/redefinir-senha?token=…` → `Senha alterada. Entre com a nova senha.`
   - Login com a senha recuperada: redirecionou para `/`.
3. **Google demo (conta nova)**
   - `/login` → `Continuar com Google` → consentimento demo → callback `303` → `/`.
   - `/conta`: `Técnico Demo`, `demo.google@exemplo.local`, `Minha empresa`, `E-mail verificado`, `Acesso com Google`.
4. **Google demo × conta local não verificada**
   - Conta local `demo.google@exemplo.local` criada e **não** verificada.
   - Tentativa de OAuth demo redirecionou para `/login?erro=CONTA_LOCAL_NAO_VERIFICADA`, sem sessão.
   - Login local confirmou que a conta continuou `E-mail não verificado` e `Acesso com senha`.

### 2.4 Smoke de produção (`corepack pnpm start`)

- `GET /api/health` → `200 {"status":"ok"}`.
- `GET /api/v1/auth/google` → `503` com `Login com Google não configurado.`
- `GET /api/v1/auth/google/demo` → `404`.
- `GET /api/v1/auth/demo-links` → `404`.

Nenhuma credencial, token ou segredo apareceu em log, resposta ou mensagem.

### 2.5 Auditoria visual

Seis páginas novas (`/login`, `/registro`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha`, `/conta`) em 375, 768, 1280 e 1440 px × claro e escuro: **48 combinações**.

- Overflow horizontal: **0** (`scrollWidth === clientWidth` em todas).
- Alvos interativos abaixo de 44 px: **0**.
- Tema aplicado corretamente nas 48 combinações (duas leituras iniciais em `/verificar-email`/`/registro` foram falsos negativos de hidratação; confirmadas com espera condicional pelo atributo `data-theme`).
- Console: sem erros nas páginas auditadas. Os erros capturados no período foram do servidor de desenvolvimento corrompido por uma reexecução de `next build` com `dev` ativo (500/HMR/`hot-update`) e o `404` de `favicon.ico`, todos fora das páginas auditadas após reinício do dev server.

### 2.6 Polida final e revisão independente

Um revisor sênior externo avaliou o intervalo `7622255..4cc16d8` contra a spec, os cinco Review Focus e a qualidade de código. Não encontrou problemas críticos. Cinco achados foram tratados com RED → GREEN:

| Arquivo | Achado | Correção |
| --- | --- | --- |
| `src/lib/auth/tokens.ts`, `src/lib/auth/conta.ts` | `consumirToken` queimava o token antes da gravação que ele autoriza; uma falha downstream deixava o usuário sem token e no cooldown de 60 s | `consumirToken` aceita cliente opcional; verificação e redefinição passaram a consumir + gravar na mesma transação. O hash Argon2 é calculado antes da transação. Testes injetam `RAISE EXCEPTION` real via trigger, sem mock |
| `src/lib/auth/conta.ts` | Duas submissões simultâneas podiam passar pelo `SELECT` de e-mail duplicado e virar `500` com `23505` | `catch` normaliza `23505` (inclusive dentro de `cause`, como o Drizzle embrulha) para a mesma resposta `E-mail já cadastrado.` |
| `src/app/conta/page.tsx` | Cartão de perfil ficava com nome/empresa antigos após salvar; conta Google que criava senha não mostrava o campo "Senha atual" até recarregar | estado local atualizado após PATCH e após troca de senha |
| `docs/auth-google.md` | Contrato do webhook documentava campo `token` inexistente | documento corrigido para `link` (contém o token) e aviso de que a caixa demo é compartilhada no dev |

Achados **não adotados**, com razão:

- **Caixa demo listar links de todas as contas:** é dev-only (`404` em produção) e foi desenhada como caixa compartilhada de desenvolvimento por decisão explícita do plano; a resposta não depende de parâmetro de e-mail e o guia agora alerta para não usar endereços reais. Alternativa (escopo por cookie) mudaria o contrato já validado por E2E.
- **Limpeza de tokens antigos:** não há agendador no projeto; YAGNI.
- **Padronização de tempo de resposta com webhook:** `EMAIL_WEBHOOK_URL` não está configurado; `byte-idêntico` atende ao requisito literal, e fila própria sai do escopo.
- **Teste de integração do callback real e claims `nonce`/`iat`/`nbf`:** hardening futuro para quando credenciais Google reais existirem; PKCE + `state` + validação RS256/JWKS já cobrem o fluxo atual.

## 3. Segurança e privacidade

- Respostas de `reenviar` e `esqueci` são `202 { ok: true }` byte-idênticas.
- Tokens brutos nunca persistem; apenas hash SHA-256, com expiração, uso único e cooldown. Consumo e mudança autorizada ocorrem na mesma transação, então falha de gravação não queima o token.
- `state` OAuth em cookie HttpOnly e `retorno` removido: callback redireciona sempre para `/`, sem open redirect.
- Google só vincula quando `email_verified` do Google **e** `emailVerificadoEm` local existem; sub divergente é recusado.
- Modo demo restrito a `NODE_ENV !== 'production'`; sem credenciais Google a rota inicial responde `503`.
- `.env.local` nunca foi lido, impresso ou commitado; nenhum valor real de credencial foi usado.

## 4. Observações operacionais

- `next build` e `next dev` não podem compartilhar `.next`: a reexecução do build com o dev server ativo derrubou o HMR com `Cannot find module './15.js'`. O dev server foi reiniciado e a auditoria visual concluída. O build em si permaneceu verde.
- PGlite em 37 workers pode apresentar `TestTimeoutError` transitório por contenção; a suíte final passou integralmente sem reexecução.
- A limpeza da conta Google demo para o teste de vínculo foi feita por script temporário não versionado, removido em seguida.

## 5. Estado final

Commits locais da Task 9:

- `dff3f58 fix(auth): corrige tipos de build e e-mail do reenvio`
- `b6a1234 fix(auth): estabiliza caixa demo e verificacao no StrictMode`
- `4cc16d8 docs: relatorio de auditoria do login completo`
- commit seguinte: polida final (transação de token, concorrência de cadastro, estado de `/conta` e documentação).

O ledger local `.superpowers/sdd/2026-11-20-laudo-rapido-auth-completo/progress.md` foi mantido fora do commit, conforme o plano.

Nenhum push, merge ou deploy foi executado.
