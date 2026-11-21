# LaudoRápido — Legal, planos e OAuth de produção Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar páginas legais honestas, corrigir a vitrine de planos e apontar o OAuth para `laudo-rapido.vercel.app`, mantendo o gate privado e sem cobrança real.

**Architecture:** Documentos legais são conteúdo estático em PT-BR servido por rotas públicas no grupo `(publico)`, com links traduzidos num rodapé global montado no layout raiz. Preços e limites saem de um catálogo de domínio simples, sem API nem pagamento. O config OAuth falha fechado em produção quando `GOOGLE_REDIRECT_URI` está ausente.

**Tech Stack:** Next.js App Router, TypeScript, React, Vitest + Testing Library, Vercel CLI. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-11-21-laudo-rapido-legal-saas-oauth-design.md`

**Plano subsequente:** as Tasks 8–11 do gate continuam em `docs/superpowers/plans/2026-11-21-laudo-rapido-gate-producao.md` e devem ser executadas depois deste plano, antes do deploy.

## Global Constraints

- Controlador: `Artur Fernandes Macêdo Vinhas`; contato: `macedoartur1250@gmail.com`. Sem CNPJ, endereço ou encarregado inventados.
- Domínio de produção: `laudo-rapido.vercel.app`. Callback: `https://laudo-rapido.vercel.app/api/v1/auth/google/callback`.
- PT-BR é a versão autoritativa dos documentos legais. Todos os textos novos precisam de chave nos cinco idiomas: `ptBR`, `en`, `es`, `fr`, `de`.
- Não traduzir o corpo jurídico. Traduzir só títulos, links e o aviso de prevalência da versão PT-BR.
- Sem banner de cookies. Só existem cookies essenciais e nenhum rastreador de terceiros.
- Sem cobrança real, checkout, campo de pagamento, chave Asaas ou chamada de rede para Asaas.
- Nenhuma promessa de recurso não implementado na vitrine de planos.
- Rotas legais são públicas no middleware e nunca entram no cache do service worker.
- Gate existente intacto: `EMAIL_PERMITIDO`, `exigirAcesso()` e as rotas bloqueadas não mudam.
- Rótulos PT-BR preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`.
- Nenhuma credencial, token ou segredo em chat, log, commit ou mensagem de erro. Não ler `.env.local`.
- Commits locais frequentes com `git add` explícito; nunca `git commit -am`. Sem push, merge ou deploy até o dono pedir.
- Comando confiável da suíte: `corepack pnpm vitest run --maxWorkers=4`. Não alterar `vitest.config.ts`.

## Review Focus

1. Visitante sem sessão em `/privacidade`, `/termos`, `/cookies` deve receber `200`; `/planos`, `/o/x` e `/conta` continuam redirecionando para `/em-desenvolvimento`. Teste: `tests/middleware.test.ts` e `tests/paginas-legais.test.tsx`.
2. Trocar idioma deve mudar títulos e links, mas nunca o corpo legal; o aviso de prevalência PT-BR aparece nos cinco idiomas. Teste: `tests/rodape-legal.test.tsx`.
3. Produção sem `GOOGLE_REDIRECT_URI` deve devolver `null` em `configuracaoGoogle()`, nunca cair em `localhost`. Teste: `tests/oauth-config.test.ts`.
4. Preço da vitrine deve bater com o catálogo de domínio; os quatro ids e os valores `0`, `29.90`, `79.90`, `null` não podem divergir. Teste: `tests/planos.test.ts`.
5. Nenhuma página legal usa `dangerouslySetInnerHTML`, e nenhuma string de plano exibe promessa não implementada. Teste: `tests/planos.test.ts` e `tests/paginas-legais.test.tsx`.

---

### Task 1: Rotas e conteúdo legal público

**Files:**
- Create: `src/lib/legal/conteudo.ts`
- Create: `src/app/(publico)/privacidade/page.tsx`
- Create: `src/app/(publico)/termos/page.tsx`
- Create: `src/app/(publico)/cookies/page.tsx`
- Modify: `src/middleware.ts`, `tests/middleware.test.ts`
- Test: `tests/paginas-legais.test.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `DOCUMENTOS` em `src/lib/legal/conteudo.ts`, com forma `{ privacidade: DocumentoLegal; termos: DocumentoLegal; cookies: DocumentoLegal }`, onde `DocumentoLegal = { titulo: string; vigencia: string; aviso: string; secoes: Array<{ titulo: string; paragrafos: string[] }> }`. `ROTAS_PUBLICAS` passa a conter as três rotas.

- [ ] **Step 1: Write the failing tests**

Em `tests/middleware.test.ts`, acrescentar `'/privacidade'`, `'/termos'`, `'/cookies'` ao array `LIBERADAS` e manter a asserção `ROTAS_PUBLICAS` igual a `LIBERADAS`.

Em `tests/paginas-legais.test.tsx` (`@vitest-environment jsdom`), para cada documento renderizar a página dentro de `ProvedorPreferencias` e afirmar:
- o título esperado: `Política de Privacidade`, `Termos de Uso`, `Política de Cookies`;
- a data `21/11/2026`;
- o aviso `A versão em português do Brasil prevalece em caso de divergência.`.

Acrescentar um teste com `readFileSync` lendo os três arquivos de página e afirmando que nenhum contém a string `dangerouslySetInnerHTML`.

Afirmar também, no documento de privacidade, as frases exatas:
- `Artur Fernandes Macêdo Vinhas`;
- `macedoartur1250@gmail.com`;
- `Fotos e assinaturas são enviadas ao Cloudflare R2 e ficam com URL pública.`;
- `Não existe hoje rotina automática de expurgo; pedidos são atendidos manualmente pelo canal de contato.`;
- `O tratamento desses dados é condição para usar o serviço.`;

No documento de cookies, as frases exatas:
- `sessao`;
- `oauth`;
- `laudo-rapido:preferencias:v1`;
- `laudo-rapido-offline`;
- `Não há analytics, anúncios, pixels, perfilamento ou rastreadores de terceiros.`;
- `Por isso, não exibimos banner de consentimento nesta versão.`

Nos termos, as frases exatas:
- `Nenhuma cobrança é feita nesta versão.`;
- `Lei brasileira e foro da comarca do controlador.`

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/middleware.test.ts tests/paginas-legais.test.tsx`
Expected: FAIL — módulos e rotas inexistentes.

- [ ] **Step 3: Implement**

Seguir o checklist integral da seção 4 do spec para escrever `DOCUMENTOS`. Cada seção do spec vira um objeto em `secoes`, com título e parágrafos em texto puro. Renderizar com `map` para `<section>`, `<h2>` e `<p>`. Nenhum HTML injetado. Cada página é server component simples que lê `DOCUMENTOS` e devolve o conteúdo.

Adicionar as três rotas a `ROTAS_PUBLICAS` em `src/middleware.ts`, mantendo a ordem atual das demais rotas. Atualizar o comentário do topo do arquivo para incluir páginas legais entre as rotas públicas.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/middleware.test.ts tests/paginas-legais.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/lib/legal/conteudo.ts "src/app/(publico)/privacidade/page.tsx" "src/app/(publico)/termos/page.tsx" "src/app/(publico)/cookies/page.tsx" src/middleware.ts tests/middleware.test.ts tests/paginas-legais.test.tsx`
`git commit -m "feat(legal): paginas publicas de privacidade, termos e cookies"`

---

### Task 2: Rodapé global e links contextuais

**Files:**
- Create: `src/components/RodapeLegal.tsx`
- Modify: `src/app/layout.tsx`, `src/app/(publico)/login/FormularioLogin.tsx`, `src/app/(app)/planos/page.tsx`, `src/app/(app)/conta/page.tsx`, `src/app/(app)/configuracoes/page.tsx`, `src/lib/i18n/dicionario.ts`
- Test: `tests/rodape-legal.test.tsx`

**Interfaces:**
- Consumes: `useT()` de `src/lib/i18n/useT`; `ProvedorPreferencias`.
- Produces: `RodapeLegal` sem props, montado no layout raiz. Chaves novas: `legalRodapePrivacidade`, `legalRodapeTermos`, `legalRodapeCookies`, `legalPrevalencia`, `loginAvisoLegal`, `contaPrivacidadeTitulo`, `contaPrivacidadeTexto`, `configPrivacidadeTitulo`, `configPrivacidadeTexto`.

- [ ] **Step 1: Write the failing tests**

Em `tests/rodape-legal.test.tsx` (`jsdom`), renderizar `RodapeLegal` dentro de `ProvedorPreferencias` e afirmar:
- três links com `href` `/privacidade`, `/termos`, `/cookies`;
- textos PT-BR `Privacidade`, `Termos de Uso`, `Cookies`;
- texto `A versão em português do Brasil prevalece em caso de divergência.`;
- trocando a preferência de idioma para `en`, os rótulos viram `Privacy`, `Terms of Use`, `Cookies`, e o aviso de prevalência continua presente.

Acrescentar um teste que renderiza `FormularioLogin` e afirma a presença do texto de aviso LGPD com links para `/privacidade` e `/termos`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/rodape-legal.test.tsx`
Expected: FAIL — componente e chaves inexistentes.

- [ ] **Step 3: Implement**

`RodapeLegal` é client component com `<footer>` e três `<Link>`; usa `useT()`. Montar após `{children}` em `src/app/layout.tsx`, dentro de `ProvedorPreferencias`.

Adicionar as nove chaves nos cinco dicionários. Valores PT-BR exatos para aviso e títulos; nos outros quatro idiomas, traduzir títulos e manter o aviso de prevalência traduzido.

Em `FormularioLogin.tsx`, inserir logo acima da linha divisória final um `<p>` com `t('loginAvisoLegal')` e links inline para `/privacidade` e `/termos`. Preservar `Entrar` e os links `Voltar ao início` e `Planos`.

Em `planos/page.tsx`, acrescentar ao rodapé da página, ao lado de `planosAviso`, links para `/termos` e `/privacidade`.

Em `conta/page.tsx` e `configuracoes/page.tsx`, acrescentar uma seção “Privacidade e seus dados” com o texto de que não existe exportação ou exclusão self-service e que pedidos vão pelo e-mail do controlador, com link para `/privacidade`.

- [ ] **Step 4: Run tests, i18n e build**

Run: `corepack pnpm vitest run tests/rodape-legal.test.tsx tests/i18n.test.ts && corepack pnpm build`
Expected: PASS; `tests/i18n.test.ts` continua provando que os cinco idiomas têm exatamente as mesmas chaves.

- [ ] **Step 5: Commit**

`git add src/components/RodapeLegal.tsx src/app/layout.tsx "src/app/(publico)/login/FormularioLogin.tsx" "src/app/(app)/planos/page.tsx" "src/app/(app)/conta/page.tsx" "src/app/(app)/configuracoes/page.tsx" src/lib/i18n/dicionario.ts tests/rodape-legal.test.tsx`
`git commit -m "feat(legal): rodape global e avisos de privacidade nos fluxos"`

---

### Task 3: Catálogo de planos, preços e preparação SaaS

**Files:**
- Create: `src/lib/saas/planos.ts`
- Create: `docs/saas-preparacao.md`
- Modify: `src/lib/i18n/dicionario.ts`, `src/app/(app)/planos/page.tsx`
- Test: `tests/planos.test.ts`

**Interfaces:**
- Consumes: `ChaveTexto` de `src/lib/i18n/dicionario`.
- Produces: `export type IdPlano = 'gratuito' | 'pro' | 'equipe' | 'empresas'`; `export type PlanoCatalogo = { id: IdPlano; nome: ChaveTexto; preco: ChaveTexto; precoNumero: number | null; dica: ChaveTexto; itens: ChaveTexto; destaque?: boolean; semPeriodo?: boolean }`; `export const CATALOGO_PLANOS: PlanoCatalogo[]`.

- [ ] **Step 1: Write the failing tests**

Em `tests/planos.test.ts`:
- `CATALOGO_PLANOS` tem exatamente quatro entradas com ids `gratuito`, `pro`, `equipe`, `empresas`;
- `precoNumero` é, na ordem, `0`, `29.9`, `79.9`, `null`;
- nenhuma string `itens` de `ptBR` contém, case-insensitive: `API`, `SLA`, `Gerente de conta`, `Marca da empresa`, `Modelos personalizados`, `12 meses`, `Usuários ilimitados`, `Suporte prioritário`;
- `ptBR.planosAviso` continua igual a `Valores de referência. Nenhuma cobrança é feita nesta versão.`;
- renderizar a página de planos com `ProvedorPreferencias` e afirmar que aparecem `R$ 29,90` e `R$ 79,90`, e que não aparecem `R$ 19,90` nem `R$ 39,90`.

- [ ] **Step 2: Run tests to verify it fails**

Run: `corepack pnpm vitest run tests/planos.test.ts`
Expected: FAIL — catálogo inexistente e preços antigos.

- [ ] **Step 3: Implement**

Criar `CATALOGO_PLANOS` com os quatro planos. Itens PT-BR honestos, limitados ao que existe hoje: visitas, fotos, assinatura, PDF, sincronização offline e histórico no aparelho. Textos:
- Gratuito: `Visitas ilimitadas;Fotos e assinatura;Laudo em PDF;Sincronização offline;Histórico no aparelho`
- Pro: `Tudo do Gratuito;Uso profissional;Sem anúncios`
- Equipe: `Tudo do Pro;Uso compartilhado da conta;Organização por empresa`
- Enterprise: `Escopo sob consulta;Contrato direto;Sem cobrança nesta versão`

Ajustar `planos/page.tsx` para consumir `CATALOGO_PLANOS` em vez do array local, mantendo o mesmo layout e a FAQ existente. Ajustar chaves de preço e itens nos cinco idiomas; preços em reais permanecem idênticos em todos os idiomas.

Escrever `docs/saas-preparacao.md` com: catálogo e preços, modelo de assinatura desejado com Asaas (cliente, assinatura, cobrança recorrente, webhook, status `ativo`/`inadimplente`/`cancelado`, renovação e cancelamento), taxas Pix `R$1,99` e cartão `R$0,49 + 2,99%`, requisitos CDC para cobrança futura (preço, periodicidade, total, renovação, cancelamento, arrependimento de 7 dias) e aviso explícito de que nada disso está implementado.

- [ ] **Step 4: Run tests and build**

Run: `corepack pnpm vitest run tests/planos.test.ts tests/i18n.test.ts && corepack pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

`git add src/lib/saas/planos.ts docs/saas-preparacao.md src/lib/i18n/dicionario.ts "src/app/(app)/planos/page.tsx" tests/planos.test.ts`
`git commit -m "feat(planos): catalogo honesto e preparacao de assinatura sem cobranca"`

---

### Task 4: OAuth apontado para produção com fail closed

**Files:**
- Modify: `src/lib/auth/google.ts`, `.env.example`
- Test: `tests/oauth-config.test.ts`

**Interfaces:**
- Consumes: `ConfigGoogle` já definido em `src/lib/auth/google.ts`.
- Produces: `configuracaoGoogle(): ConfigGoogle | null` com comportamento alterado apenas em produção.

- [ ] **Step 1: Write the failing tests**

Em `tests/oauth-config.test.ts`, com `vi.stubEnv` e restauração em `afterEach`:
- `NODE_ENV='production'`, `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` presentes, sem `GOOGLE_REDIRECT_URI` → `configuracaoGoogle()` devolve `null`;
- `NODE_ENV='production'` com `GOOGLE_REDIRECT_URI='https://laudo-rapido.vercel.app/api/v1/auth/google/callback'` → `redirectUri` é exatamente essa string;
- `NODE_ENV='development'` com client id/secret e sem `GOOGLE_REDIRECT_URI` → `redirectUri` é `http://localhost:3000/api/v1/auth/google/callback`.

Teste adicional: com `NODE_ENV='production'`, sem variáveis, `configuracaoGoogle()` devolve `null` e `modoDemo()` devolve `false`.

- [ ] **Step 2: Run tests to verify it fails**

Run: `corepack pnpm vitest run tests/oauth-config.test.ts`
Expected: FAIL no primeiro caso.

- [ ] **Step 3: Implement**

Em `configuracaoGoogle()`, manter a leitura de `clientId` e `clientSecret`. Se `process.env.NODE_ENV === 'production'`, devolver `null` quando `GOOGLE_REDIRECT_URI` estiver vazio. Em desenvolvimento, manter o fallback localhost atual. Não alterar endpoints, escopo, PKCE, validação de `id_token` nem o callback.

Adicionar a `.env.example`, sem valores:
```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback
```
Comentar que em produção o valor deve ser `https://laudo-rapido.vercel.app/api/v1/auth/google/callback`.

- [ ] **Step 4: Run tests and build**

Run: `corepack pnpm vitest run tests/oauth-config.test.ts tests/auth-rotas.test.ts && corepack pnpm build`
Expected: PASS; nenhuma rota de auth demo em produção.

- [ ] **Step 5: Commit**

`git add src/lib/auth/google.ts .env.example tests/oauth-config.test.ts`
`git commit -m "fix(oauth): redirect de producao obrigatorio e fail closed"`

---

### Task 5: Verificação do plano e relatório

**Files:**
- Create: `docs/superpowers/reports/2026-11-21-legal-saas-oauth-relatorio.md`
- Test: nenhum novo; executar suíte completa.

**Interfaces:**
- Consumes: tudo deste plano.

- [ ] **Step 1: Run full verification**

Run: `corepack pnpm vitest run --maxWorkers=4`
Expected: todos os arquivos e testes PASS, sem exceção.

Run: `corepack pnpm build`
Expected: exit 0.

- [ ] **Step 2: Smoke local das rotas públicas**

Subir `corepack pnpm dev` e validar com `curl`:
- `curl -s -o NUL -w "%{http_code}" http://localhost:3000/privacidade` → `200`;
- o mesmo para `/termos` e `/cookies` → `200`;
- `curl -s -o NUL -w "%{http_code}" http://localhost:3000/planos` sem cookie → `307`;
- presença dos três links no HTML de `/login`.

- [ ] **Step 3: Write the report**

Registrar no relatório: commits, evidências RED/GREEN de cada task, resultado da suíte, resultado do build, respostas do smoke, e a lista do que ainda bloqueia deploy: Tasks 8–11 do gate, variáveis de ambiente pelo dono, cadastro da URI no Google Cloud Console e confirmação explícita para `vercel --prod`.

- [ ] **Step 4: Commit**

`git add docs/superpowers/reports/2026-11-21-legal-saas-oauth-relatorio.md`
`git commit -m "docs: relatorio de legal, planos e oauth de producao"`

**Não incluído neste plano:** `vercel --prod`, push, merge, criação de projeto Vercel, configuração de variáveis no painel e cadastro da URI no Google Console.
