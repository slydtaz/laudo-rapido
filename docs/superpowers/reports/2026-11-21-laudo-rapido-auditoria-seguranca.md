# Auditoria de segurança — LaudoRápido (21/11/2026)

Escopo autorizado: repositório local do LaudoRápido, branch `feature/laudo-rapido-mvp`, HEAD `77eab0a`.
Método: revisão estática read-only (grep/leitura de arquivos), threat modeling e conferência de configuração.
Nenhuma credencial foi lida de `.env.local`, impressa em log ou enviada a terceiros. Nenhum teste intrusivo foi executado em produção.

## Resumo executivo

Nenhum achado **Crítico** confirmado. Os riscos mais altos não são falhas de criptografia, sim de **controle de acesso**: o middleware atual só verifica a presença do cookie e não há allowlist, de modo que qualquer conta autenticada (e qualquer visitante de páginas hoje públicas) entra no produto. Isso se torna Alto no momento em que a versão Vercel passa a ser restrita a um único e-mail.

O medo específico relatado — alguém editar um arquivo salvo no aparelho e escrever `assinatura: Paga` — **não mapeia para o schema atual**: não existe campo de assinatura paga. `assinaturas` é a tabela da imagem da assinatura do cliente no laudo (`schema.ts:78-86`), e os planos são estáticos com o aviso `Nenhuma cobrança é feita nesta versão`. Ainda assim há um achado Médio relacionado: o DTO aceita campos extras silenciosamente.

## Achados

### ALTO A1 — Gate de página por presença de cookie

- **Local:** `src/middleware.ts:27-35` e `src/middleware.ts:8-24`.
- **Evidência:** o middleware faz `req.cookies.has('sessao')` e comenta explicitamente que a validação real (`lerSessao`) acontece nas rotas. Páginas como `/`, `/planos`, `/registro` e `/o/[token]` não chamam `lerSessao`.
- **Impacto:** um cookie `sessao=qualquervalor` satisfaz o gate. Qualquer pessoa vê as páginas públicas; o link de entrega `/o/:token` responde sem sessão.
- **Probabilidade:** alta — é o comportamento atual, não uma condição de corrida.
- **Correção:** gate server-side com `exigirAcesso()` (sessão válida no banco + allowlist) no layout do grupo interno e em todas as APIs. Ver desenho `2026-11-21-laudo-rapido-producao-gate-design.md`.

### ALTO A2 — Ausência de allowlist

- **Local:** `src/lib/auth/session.ts:55-68`, `src/app/api/v1/auth/google/callback/route.ts:60-76`.
- **Evidência:** `lerSessao` devolve apenas `{ usuarioId, empresaId }`; o callback do Google cria/vincula conta para qualquer e-mail e emite sessão. Nenhuma comparação com `macedoartur1250@gmail.com` existe.
- **Impacto:** qualquer conta Google autenticada teria acesso ao app na versão publicada.
- **Probabilidade:** alta se o deploy for feito sem essa checagem.
- **Correção:** variável `EMAIL_PERMITIDO` somente no servidor; helper `exigirAcesso()` compara o e-mail da sessão (case-insensitive, sem espaços) antes de qualquer página ou API de dados.

### ALTO A3 — Link público de entrega sem autenticação

- **Local:** `src/app/o/[token]/page.tsx:11-27`, `src/lib/visita/publico.ts`, `src/middleware.ts:23`.
- **Evidência:** `/o` está na lista de rotas públicas; o token opaco de 24 bytes (192 bits) é a única credencial. O PDF é devolvido em `data:application/pdf;base64,...`.
- **Impacto:** quem obtém o link abre o laudo sem conta. É uma escolha de produto legítima hoje, mas contradiz o requisito novo “login em TODAS as páginas”.
- **Probabilidade:** certa.
- **Correção:** decisão do usuário — bloquear `/o/*` no Vercel e devolver a tela “em desenvolvimento”. Registrado como consequência aceita: o cliente deixa de abrir o PDF pelo link.

### MÉDIO M1 — DTO aceita campos extras silenciosamente

- **Local:** `src/lib/visita/dto.ts:9-19`.
- **Evidência:** `criarVisitaSchema` usa `z.object({ dados: z.object({...}) })`. O padrão do Zod é remover chaves desconhecidas, não rejeitá-las. Um payload local alterado com `dados: { ..., assinatura: 'Paga' }` passa na validação.
- **Impacto:** o campo forjado não chega ao banco (removido pelo Zod) e não concede benefício, mas o servidor responde sucesso para um registro adulterado, dificultando auditoria e detectabilidade.
- **Probabilidade:** média.
- **Correção:** `.strict()` em `dados` (e no objeto raiz) com teste que espera HTTP 400 para campo extra. Nunca aceitar `status`, `empresaId` ou `assinatura` vindos do cliente — hoje `criarVisita` já fixa `status: 'sincronizada'` e o tenant vem da sessão (`sync/route.ts`), o que está correto e deve ser preservado.

### MÉDIO M2 — Sem limite de tentativas em login e recuperação

- **Local:** `src/app/api/v1/auth/login/route.ts:15-43`, `src/app/api/v1/auth/senha/esqueci/route.ts`.
- **Evidência:** não há contador, janela de tempo nem resposta 429. A resposta de login é genérica (boa prática já adotada), mas nada limita tentativas repetidas.
- **Impacto:** força bruta contra a única conta e abuso do webhook de e-mail.
- **Probabilidade:** média.
- **Correção:** janela de 15 minutos por chave `ip + e-mail`, bloqueio após 10 tentativas, resposta 429. Aplicar nos dois endpoints.

### MÉDIO M3 — Service worker cacheia a página que virará bloqueio

- **Local:** `public/sw.js:11-19`, `src/components/RegistradorSW.tsx:34-36`.
- **Evidência:** `SHELL` inclui `/` e `eShell()` aceita `/` e `/visitas/nova`. O SW não reage a `updatefound`/`controllerchange`; o registro é silently ignorado.
- **Impacto:** após o gate, o SW pode servir HTML da tela de bloqueio como app shell offline e não há aviso de nova versão deployada — o usuário pode ficar preso a um bundle antigo até limpar o cache.
- **Probabilidade:** alta após o deploy.
- **Correção:** remover páginas HTML do cache, manter só assets + fallback `/offline`; adicionar aviso de atualização com `skipWaiting` e recarregamento controlado.

### MÉDIO M4 — Ausência de cabeçalhos de segurança

- **Local:** `next.config.ts:3` (`const nextConfig: NextConfig = {}`).
- **Evidência:** nenhum `headers()` com CSP, `X-Content-Type-Options`, `Referrer-Policy` ou `X-Frame-Options`.
- **Impacto:** falta defesa em profundidade contra XSS e clickjacking.
- **Probabilidade:** baixa de exploração isolada, mas o custo de correção é baixo.
- **Correção:** CSP com `connect-src` restrito, `object-src 'none'`, `frame-ancestors 'none'`; `nosniff`; `strict-origin-when-cross-origin`. Observação: o Next usa scripts inline, então `script-src 'unsafe-inline'` ainda é necessário — a CSP limita exfiltração, não substitui escape.

### BAIXO B1 — `dangerouslySetInnerHTML` único e estático

- **Local:** `src/app/layout.tsx:69`, com `SCRIPT_PREFERENCIAS`.
- **Evidência:** script constante, sem interpolação de entrada do usuário. React escapa todo o restante da árvore; `src/app/visitas/page.tsx:208` usa `target="_blank"` com `rel="noreferrer"` correto.
- **Impacto:** nenhum explorável identificado.
- **Correção:** manter; proibir novos usos e qualquer interpolação nesse script.

### INFO I1 — Cookies de sessão e OAuth

- **Local:** `src/lib/auth/cookie.ts:25-35`.
- **Evidência:** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção, 7 dias para sessão e 10 minutos para OAuth. PKCE e JWKS implementados em `google.ts`.
- **Avaliação:** configuração adequada. O prefixo `__Host-` não é usado; não é necessário para este modelo de ameaças, mas poderia ser adotado futuramente.

### INFO I2 — Confiança em dados locais (offline-first)

- **Local:** `src/lib/offline/queue.ts:24-27`, `src/app/api/v1/visitas/sync/route.ts`, `src/lib/visita/sync.ts:20-40`.
- **Evidência:** `empresaId` é derivado de `lerSessao(req)` na rota; `dados` passa por Zod; fotos e assinatura passam por validação de MIME/data URL em `storage/client.ts`.
- **Avaliação:** o vetor “editar arquivo local para virar outro tenant/pago” está mitigado no servidor. Reforço pendente é M1.

## Priorização

1. A1 + A2 (gate e allowlist) — bloqueiam o deploy.
2. A3 (link público) — decisão já tomada; bloquear.
3. M1 + M2 + M3 + M4 — mesma entrega, antes do deploy.
4. B1 / I1 / I2 — monitorar e preservar.

## O que não foi encontrado

- Nenhum segredo hardcoded em arquivos versionados; `.env.local` e `.env.*.local` estão no `.gitignore`.
- Nenhuma injeção SQL: Drizzle com parâmetros, nenhuma concatenação de SQL com entrada do usuário.
- Nenhum campo de cobrança, status de pagamento ou plano por usuário no banco — plano é vitrine estática.

---

## Estado final (Task 11 do gate de produção)

Escopo desta atualização: HEAD `6703f0e`, branch `feature/laudo-rapido-mvp`. Os achados acima permanecem
registrados como descobertas originais; a coluna abaixo descreve o estado verificado após as correções
das Tasks 1–10 e do plano legal/SaaS/OAuth.

| Item | Estado final | Evidência |
| --- | --- | --- |
| A1 — gate por presença de cookie | **Corrigido.** O middleware continua como filtro rápido, mas a decisão real passou a ser server-side: `exigirAcesso()` valida sessão no banco e allowlist antes de páginas e APIs protegidas. | `tests/acesso.test.ts`, `tests/acesso-apis.test.ts` (gate em APIs e `/registro`), `tests/middleware.test.ts` (307 nas páginas protegidas, 403 nas APIs), `tests/telas-bloqueio.test.tsx` |
| A2 — ausência de allowlist | **Corrigido.** `EMAIL_PERMITIDO` é lido somente no servidor; comparação normalizada e *fail closed* sem a variável. Outro e-mail recebe 403/redirecionamento neutro. | `tests/acesso.test.ts` (rejeição e fail closed), `tests/acesso-apis.test.ts` (`403 ERRO_ACESSO`), `tests/google-rota.test.ts` (`CONTA_LOCAL_NAO_VERIFICADA`), `tests/auth-rotas.test.ts` |
| A3 — link público de entrega | **Decisão aplicada.** `/o/*` não é mais público: sem sessão responde 307 para `/em-desenvolvimento`; a consulta ao laudo permanece testada apenas como domínio. | `tests/middleware.test.ts` (`/o/x` na lista protegida), `tests/public-link.test.ts`, `tests/telas-bloqueio.test.tsx` |
| M1 — DTO aceitava campos extras | **Corrigido.** `.strict()` no objeto raiz e em `dados`; `assinatura`, `status`, `empresaId` e `plano` vindos do cliente são rejeitados. | `src/lib/visita/dto.ts:9-25`, `tests/visita.test.ts:23-46`, `tests/sync.test.ts` |
| M2 — sem limite de tentativas | **Corrigido.** Janela de 15 minutos, 10 tentativas por `ip + e-mail`, resposta 429; chave normalizada e sem log de segredo. | `src/lib/auth/rate-limit.ts`, `tests/rate-limit.test.ts`, `tests/auth-rotas.test.ts:153-186` |
| M3 — service worker cacheava HTML do gate | **Corrigido.** Pré-cache apenas de assets e `/offline`; navegação não grava HTML no cache; aviso de nova versão com `SKIP_WAITING` e recarga única após aceite. | `tests/service-worker.test.ts:164-236`, `tests/atualizacao-pwa.test.tsx:105-149`, `public/sw.js`, `src/components/RegistradorSW.tsx` |
| M4 — ausência de cabeçalhos de segurança | **Corrigido.** CSP com `default-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `connect-src 'self'`; `nosniff`, `strict-origin-when-cross-origin` e `X-Frame-Options`. | `next.config.ts`, `tests/security-headers.test.ts:12-35` |
| B1 — `dangerouslySetInnerHTML` estático | **Preservado e vigiado.** Continua apenas no script constante do layout; páginas legais não usam injeção de HTML; novos usos permanecem proibidos. | `src/app/layout.tsx`, `tests/paginas-legais.test.tsx:43-52` |
| I1 — cookies de sessão e OAuth | **Adequado, sem alteração.** `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` em produção, 7 dias/10 minutos; PKCE e JWKS mantidos. | `src/lib/auth/cookie.ts`, `tests/cookie.test.ts:19-65`, `tests/google.test.ts` |
| I2 — confiança em dados locais (offline-first) | **Mitigado no servidor.** `empresaId` vem da sessão, DTO estrito, mídia validada; nenhum campo forjado altera tenant ou plano. | `tests/sync.test.ts`, `tests/visita.test.ts:23-57`, `tests/midia.test.ts`, `tests/imagem.test.ts` |

### Evidências de verificação da Task 11

- `corepack pnpm vitest run --maxWorkers=4`: **47 arquivos / 227 testes aprovados**, exit 0, 117,34 s.
- `corepack pnpm build`: **exit 0**, 38 páginas geradas (`✓ Generating static pages (38/38)`).
- `corepack pnpm test` (tentativa única, sem alterar `vitest.config.ts`): **47 arquivos / 227 testes aprovados**, exit 0, 91,92 s. Nenhum flake de PGlite observado nesta execução; `--maxWorkers=4` permanece como evidência autoritativa.
- Smoke local em `http://127.0.0.1:3100` (`corepack pnpm dev -p 3100`, servidor encerrado ao final): `/privacidade` 200, `/termos` 200, `/cookies` 200, `/planos` sem cookie 307, `/api/health` 200. O HTML de `/login` (200) contém `/privacidade`, `/termos`, `/cookies` e `Entrar`. Não houve login Google real; o bloqueio de outro e-mail é coberto por `tests/acesso-apis.test.ts` e `tests/google-rota.test.ts`.
- Rótulos preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`. Nenhum código, teste, preço, texto legal, OAuth, middleware, SW, gate ou smoke label foi alterado nesta task.

### Bloqueios de deploy e confirmação

Nada foi implantado. Não houve `vercel --prod`, `vercel link`, criação de projeto, configuração de
variáveis no painel, migração em produção, cadastro da URI no Google Cloud Console, push ou merge.
Restam como bloqueios externos, de responsabilidade do dono: configurar as 15 variáveis listadas em
`docs/deploy-vercel.md`, cadastrar `https://laudo-rapido.vercel.app/api/v1/auth/google/callback` no
Google Cloud Console e dar confirmação explícita para o deploy. Checklist em `docs/deploy-vercel.md`.
