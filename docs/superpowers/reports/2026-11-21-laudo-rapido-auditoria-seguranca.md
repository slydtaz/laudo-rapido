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
