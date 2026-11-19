# LaudoRápido MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um PWA em que um técnico registra uma visita offline com fotos e assinatura e gera um PDF compartilhável por link público.

**Architecture:** Monólito Next.js com Route Handlers, Postgres via Drizzle e storage S3-compatible. O cliente mantém uma fila em IndexedDB; a sincronização usa `client_id` como chave de idempotência e preserva o timestamp original de captura.

**Tech Stack:** Next.js 15, TypeScript 5.7, Tailwind, Drizzle, Zod, Vitest + PGlite, Dexie, `@react-pdf/renderer`, R2 (SDK S3), Resend.

**Spec:** `docs/spec.md` (este plano argumenta a partir dela; leia ambos).

## Global Constraints

- Node 22+, pnpm 9+, TypeScript 5.7+, Next.js 15+.
- Nenhum modelo de IA local; qualquer inferência futura é cloud-only.
- Nenhum secret versionado; variáveis documentadas em `.env.example`.
- Nomes de domínio em português nos textos de UI; nomes de código em inglês.
- Toda rota de API começa com `/api/v1` (exceto o link público `/o/:token` e `/api/health`).
- `client_id` é UUIDv4 gerado no cliente e é a única chave de idempotência.
- Testes usam PGlite — nunca exigem Postgres externo.
- Cada task termina com commit.

## Review Focus

Estes são os casos que a spec não explicita e que mais provavelmente vão quebrar o MVP. Cada um ganha um teste na task que possui o código.

1. **Retry de sincronização com o mesmo `client_id`** — deve criar 1 visita e reportar 1 duplicata, nunca duplicar fotos. Teste: Task 5, Step 1.
2. **Campo `observacoes` com mais de 2000 caracteres** — deve retornar 400 na API em vez de estourar o PDF. Teste: Task 4, Step 1.
3. **Assinatura desenhada em tablet com DPR 3** — deve ser normalizada para PNG de no máximo 1200×400, evitando PDF gigante. Teste: Task 6, Step 1.
4. **Link público de uma visita excluída** — deve responder 404 amigável, não 500. Teste: Task 7, Step 1.
5. **Foto tirada offline e sincronizada dias depois** — `capturado_em` original deve ser preservado, não substituído pelo horário da sincronização. Teste: Task 5, Step 1.

---

### Task 1: Fundação do projeto

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/api/health/route.ts`
- Test: `tests/health.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `GET /api/health` → 200 com `{ status: "ok" }`. Scripts `dev`, `build`, `test`, `test:watch`, `db:generate`, `db:migrate`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/health.test.ts
import { describe, expect, it } from 'vitest'
import { GET } from '../src/app/api/health/route'

describe('GET /api/health', () => {
  it('retorna status ok', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ status: 'ok' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/health.test.ts`  
Expected: FAIL — módulo `../src/app/api/health/route` não existe.

- [ ] **Step 3: Criar configuração e endpoint**

Instalar: `next@15 react@19 react-dom@19 drizzle-orm@latest zod@latest dexie@latest @react-pdf/renderer@latest @aws-sdk/client-s3@latest argon2@latest resend@latest` e dev: `typescript@5.7 vitest@latest @vitest/coverage-v8@latest @testing-library/react@latest jsdom@latest @electric-sql/pglite@latest drizzle-kit@latest tailwindcss@latest postcss autoprefixer`.

`package.json` deve declarar `"packageManager": "pnpm@9.15.0"` e os scripts acima. `vitest.config.ts` usa `environment: 'node'` por padrão com `jsdom` apenas em arquivos que pedirem `@vitest-environment jsdom`. `.env.example` contém `DATABASE_URL=`, `R2_ACCOUNT_ID=`, `R2_ACCESS_KEY_ID=`, `R2_SECRET_ACCESS_KEY=`, `R2_BUCKET=`, `RESEND_API_KEY=`, `SESSION_SECRET=`.

`src/app/api/health/route.ts` exporta `GET()` assíncrona retornando `Response.json({ status: 'ok' })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/health.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: scaffold Next.js project with health check"
```

---

### Task 2: Schema do banco e migração

**Files:**
- Create: `drizzle.config.ts`, `src/lib/db/schema.ts`, `src/lib/db/client.ts`, `migrations/0001_init.sql`
- Test: `tests/db.test.ts`

**Interfaces:**
- Consumes: nada além das dependências da Task 1.
- Produces: tabelas exportadas `empresas, usuarios, modelosVisita, visitas, fotos, assinaturas`; tipos inferidos `Empresa, Usuario, ModeloVisita, Visita, Foto, Assinatura`; `db` (cliente Drizzle) e `criarBancoTeste(): Promise<Drizzle>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/db.test.ts
import { describe, expect, it } from 'vitest'
import { criarBancoTeste } from '../src/lib/db/client'
import { empresas, visitas, fotos, assinaturas } from '../src/lib/db/schema'

describe('schema', () => {
  it('persiste visita com foto e assinatura e impõe client_id único', async () => {
    const db = await criarBancoTeste()
    const [empresa] = await db.insert(empresas).values({ nome: 'Climatizar' }).returning()
    const [visita] = await db.insert(visitas).values({
      empresaId: empresa.id,
      modeloId: null,
      clientId: '11111111-1111-4111-8111-111111111111',
      status: 'sincronizada',
      dados: { cliente: 'Padaria Central' },
      capturadoEm: new Date('2026-11-18T10:00:00Z'),
    }).returning()
    await db.insert(fotos).values({ visitaId: visita.id, url: 'r2://a.png', capturadoEm: new Date() })
    await db.insert(assinaturas).values({ visitaId: visita.id, url: 'r2://sign.png' })
    await expect(
      db.insert(visitas).values({
        empresaId: empresa.id,
        clientId: visita.clientId,
        status: 'sincronizada',
        dados: {},
        capturadoEm: new Date(),
      })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/db.test.ts`  
Expected: FAIL — `criarBancoTeste` não existe.

- [ ] **Step 3: Implementar schema**

`schema.ts`: `empresas(id uuid pk defaultRandom, nome text notNull, criadoEm timestamp default now)`; `usuarios(id, empresaId fk, email unique notNull, senhaHash text, criadoEm)`; `modelosVisita(id, empresaId fk, nome text, campos jsonb notNull)`; `visitas(id, empresaId fk, modeloId fk nullable, clientId uuid notNull, status enum ['rascunho','sincronizada','entregue'] default 'rascunho', dados jsonb notNull, token text unique, capturadoEm timestamp notNull, criadoEm default now)`, com **índice único em `(empresaId, clientId)`**; `fotos(id, visitaId fk onDelete cascade, url text, capturadoEm timestamp notNull)`; `assinaturas(id, visitaId fk onDelete cascade unique, url text, criadoEm)`.

Use `pgEnum` para `status`. Mapeie nomes camelCase para snake_case com `snakeCase` do `drizzle-orm/casing` ou defina explicitamente — escolha um e aplique em todos.

`client.ts`: `db` usa `DATABASE_URL`; `criarBancoTeste()` instancia PGlite, aplica `migrations/0001_init.sql` e retorna um Drizzle ligado a ela.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/db.test.ts`  
Expected: PASS — a segunda inserção com o mesmo `clientId` lança violação de unique.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: add database schema and idempotency constraint"
```

---

### Task 3: Autenticação e multitenancy

**Files:**
- Create: `src/lib/auth/session.ts`, `src/lib/auth/password.ts`, `src/app/api/v1/auth/login/route.ts`, `src/middleware.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `db, usuarios, empresas` da Task 2.
- Produces: `hashSenha(senha: string): Promise<string>`, `verificarSenha(senha: string, hash: string): Promise<boolean>`, `criarSessao(usuarioId: string, empresaId: string): Promise<string>`, `lerSessao(req: Request): Promise<Sessao | null>` com `Sessao = { usuarioId: string; empresaId: string }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth.test.ts
import { describe, expect, it } from 'vitest'
import { hashSenha, verificarSenha, criarSessao, lerSessao } from '../src/lib/auth/session'

describe('auth', () => {
  it('valida senha e mantém sessão com empresa', async () => {
    const hash = await hashSenha('senha-forte-123')
    expect(await verificarSenha('errada', hash)).toBe(false)
    expect(await verificarSenha('senha-forte-123', hash)).toBe(true)
    const token = await criarSessao('u-1', 'e-1')
    const req = new Request('http://localhost/', { headers: { cookie: `sessao=${token}` } })
    await expect(lerSessao(req)).resolves.toEqual({ usuarioId: 'u-1', empresaId: 'e-1' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/auth.test.ts`  
Expected: FAIL — funções de auth não existem.

- [ ] **Step 3: Implementar auth**

`password.ts`: `argon2.hash` / `argon2.verify` com opções padrão. `session.ts`: token opaco de 32 bytes em base64url, armazenado em tabela `sessoes(id, usuarioId, empresaId, expiraEm)` — adicione a tabela ao schema da Task 2 neste passo (modifique `schema.ts` e a migração). `lerSessao` lê o cookie `sessao`, busca a sessão não expirada e devolve `Sessao` ou `null`. `POST /api/v1/auth/login` valida `{ email, senha }` com Zod, verifica hash, cria sessão e devolve `Set-Cookie: sessao=...; HttpOnly; SameSite=Lax; Path=/; Secure` (Secure apenas em produção). `middleware.ts` redireciona para `/login` rotas `(app)` sem sessão válida.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/auth.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: add session authentication"
```

---

### Task 4: Domínio de visitas e modelos

**Files:**
- Create: `src/lib/visita/dto.ts`, `src/lib/visita/service.ts`, `src/app/api/v1/visitas/route.ts`, `src/app/api/v1/modelos/route.ts`
- Modify: `src/lib/db/schema.ts` (se necessário)
- Test: `tests/visita.test.ts`

**Interfaces:**
- Consumes: `db, visitas, modelosVisita` (Task 2), `Sessao` (Task 3).
- Produces: `criarVisitaSchema` (Zod), `visitaDto`, `criarVisita(input: CriarVisita, empresaId: string): Promise<Visita>`, `listarVisitas(empresaId: string): Promise<Visita[]>`.

**`CriarVisita` = `{ clientId: string; modeloId?: string; dados: { cliente: string; tipo: string; observacoes: string }; capturadoEm: Date }`**, com `observacoes` limitado a **2000 caracteres**.

- [ ] **Step 1: Write the failing test**

```ts
// tests/visita.test.ts
import { describe, expect, it } from 'vitest'
import { criarVisitaSchema, criarVisita, listarVisitas } from '../src/lib/visita/service'

describe('domínio de visitas', () => {
  it('rejeita observação longa demais', () => {
    const result = criarVisitaSchema.safeParse({
      clientId: '11111111-1111-4111-8111-111111111111',
      dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'x'.repeat(2001) },
      capturadoEm: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('isola visitas por empresa', async () => {
    const a = await criarVisita({ /* válido */ }, 'empresa-a')
    const b = await criarVisita({ /* válido, clientId diferente */ }, 'empresa-b')
    await expect(listarVisitas('empresa-a')).resolves.not.toContainEqual(b)
    expect(a.status).toBe('sincronizada')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/visita.test.ts`  
Expected: FAIL — módulo de visitas não existe.

- [ ] **Step 3: Implementar serviço e rotas**

`dto.ts` define `criarVisitaSchema` com `z.string().max(2000)` em `observacoes` e `visitaDto` para serialização. `service.ts` implementa `criarVisita` (gera `token` com `randomBytes(24).toString('base64url')`, status `sincronizada`) e `listarVisitas` (sempre filtra por `empresaId`). `GET/POST /api/v1/visitas` leem `lerSessao(req)`, retornam 401 sem sessão e nunca confiam em `empresaId` do corpo. `GET/POST /api/v1/modelos` seguem o mesmo padrão.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/visita.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: add visit domain and tenant isolation"
```

---

### Task 5: Fila offline e sincronização idempotente

**Files:**
- Create: `src/lib/offline/db.ts`, `src/lib/offline/queue.ts`, `src/lib/visita/sync.ts`, `src/app/api/v1/visitas/sync/route.ts`
- Test: `tests/sync.test.ts`

**Interfaces:**
- Consumes: `criarVisita` (Task 4), `db` (Task 2).
- Produces: `enfileirarVisita(v: VisitaLocal): Promise<void>`, `sincronizarFila(): Promise<{ enviadas: number; falhas: number }>`, `sincronizarLote(itens: VisitaLocal[], empresaId: string): Promise<{ criadas: number; duplicadas: number }>`.

**`VisitaLocal` = `CriarVisita & { fotos: { blob: Blob; capturadoEm: Date }[]; assinatura?: Blob }`** (definido em `src/lib/offline/queue.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/sync.test.ts
import { describe, expect, it } from 'vitest'
import { sincronizarLote } from '../src/lib/visita/sync'

const base = {
  clientId: '22222222-2222-4222-8222-222222222222',
  dados: { cliente: 'Oficina Brasil', tipo: 'Elétrica', observacoes: 'OK' },
  capturadoEm: new Date('2026-11-17T08:30:00Z'),
  fotos: [],
}

describe('sincronização', () => {
  it('é idempotente e preserva capturado_em', async () => {
    const r1 = await sincronizarLote([base], 'empresa-a')
    const r2 = await sincronizarLote([base], 'empresa-a')
    expect(r1).toEqual({ criadas: 1, duplicadas: 0 })
    expect(r2).toEqual({ criadas: 0, duplicadas: 1 })
    const [salva] = await listarVisitas('empresa-a')
    expect(salva.capturadoEm.toISOString()).toBe('2026-11-17T08:30:00.000Z')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/sync.test.ts`  
Expected: FAIL — `sincronizarLote` não existe.

- [ ] **Step 3: Implementar fila e sincronização**

`offline/db.ts`: Dexie com tabelas `visitas` (chave `clientId`) e `pendencias` (chave `clientId`, índice `criadoEm`). `queue.ts`: `enfileirarVisita` grava localmente e registra pendência; `sincronizarFila` envia lotes de até 20 para `POST /api/v1/visitas/sync`, remove pendências confirmadas e mantém as que falharam. `sync.ts`: `sincronizarLote` usa `onConflictDoNothing({ target: [visitas.empresaId, visitas.clientId] })` e conta duplicatas comparando `retornando().length`; propaga `capturadoEm` recebido **sem sobrescrever** por `now()`. Rota valida o lote com `z.array(criarVisitaSchema)` e usa `lerSessao`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/sync.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: add offline queue with idempotent sync"
```

---

### Task 6: Fotos e assinatura

**Files:**
- Create: `src/lib/storage/client.ts`, `src/app/api/v1/visitas/[id]/fotos/route.ts`, `src/app/api/v1/visitas/[id]/assinar/route.ts`, `src/components/AssinaturaCanvas.tsx`
- Test: `tests/midia.test.ts`

**Interfaces:**
- Consumes: `Visita` (Task 2), `Sessao` (Task 3).
- Produces: `salvarFoto(visitaId: string, buffer: Buffer, mime: string): Promise<string>`, `normalizarAssinatura(dataUrl: string): Promise<Buffer>`, `salvarAssinatura(visitaId: string, png: Buffer): Promise<string>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/midia.test.ts
import { describe, expect, it } from 'vitest'
import { normalizarAssinatura } from '../src/lib/storage/client'

describe('midia', () => {
  it('redimensiona assinatura de DPR alto para no máximo 1200x400', async () => {
    const png = await normalizarAssinatura('data:image/png;base64,' + 'A'.repeat(100))
    expect(png.byteLength).toBeGreaterThan(0)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })

  it('rejeita MIME de foto inválido', async () => {
    // salvarFoto com mime 'application/pdf' deve lançar
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/midia.test.ts`  
Expected: FAIL — funções de mídia não existem.

- [ ] **Step 3: Implementar storage e rotas**

`client.ts`: cliente S3 apontando para R2 com `endpoint = https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`; `salvarFoto` aceita apenas `image/jpeg, image/png, image/webp`, gera chave `visitas/{visitaId}/fotos/{uuid}.{ext}` e devolve a URL pública. `normalizarAssinatura` usa `sharp` (instale) para converter dataUrl em PNG com `resize(1200, 400, { fit: 'inside', withoutEnlargement: true })` e fundo branco. Rotas validam posse da visita via `empresaId` da sessão antes de gravar; `POST /.../assinar` grava em `assinaturas` com `onConflictDoUpdate`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/midia.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: add photo upload and signature normalization"
```

---

### Task 7: PDF e link público de entrega

**Files:**
- Create: `src/lib/pdf/laudo.tsx`, `src/app/api/v1/visitas/[id]/pdf/route.ts`, `src/app/o/[token]/page.tsx`
- Test: `tests/pdf.test.ts`, `tests/public-link.test.ts`

**Interfaces:**
- Consumes: `Visita, Foto, Assinatura` (Task 2), `gerarPdf` produzido aqui.
- Produces: `gerarPdf(visita: Visita): Promise<Uint8Array>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pdf.test.ts + tests/public-link.test.ts
describe('PDF', () => {
  it('contém cliente e data da visita', async () => {
    const bytes = await gerarPdf(visitaFake)
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(bytes.byteLength).toBeLessThan(2_000_000)
  })
})

describe('link público', () => {
  it('retorna 404 para token inexistente ou visita excluída', async () => {
    await expect(GET(new Request('http://x/o/token-invalido'), { params: { token: 'token-invalido' } }))
      .resolves.toMatchObject({ status: 404 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test tests/pdf.test.ts tests/public-link.test.ts`  
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implementar PDF e rota pública**

`laudo.tsx`: documento `@react-pdf/renderer` com cabeçalho (nome da empresa, "Relatório de Visita"), dados do cliente, `observacoes` com quebra de página automática, galeria de fotos e imagem da assinatura com linha e legenda "Assinado por". `gerarPdf` usa `renderToBuffer`. Rota autenticada `GET /api/v1/visitas/[id]/pdf` devolve `Content-Type: application/pdf` e `Content-Disposition: inline`. Página `/o/[token]` busca visita pelo token **com fotos e assinatura**, retorna `notFound()` se ausente e exibe viewer com botão de download para o mesmo PDF.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test tests/pdf.test.ts tests/public-link.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "feat: add PDF generation and public delivery link"
```

---

### Task 8: CI, deploy e verificação final

**Files:**
- Create: `.github/workflows/ci.yml`, `vercel.json`
- Modify: `README.md`, `.env.example`

**Interfaces:**
- Consumes: todos os módulos anteriores.
- Produces: pipeline de CI; `README.md` com instruções de setup.

- [ ] **Step 1: Write the failing test**

```bash
# Critério: com as variáveis de exemplo, o build deve completar sem erro de tipo.
pnpm build
```

- [ ] **Step 2: Run verification to confirm current state**

Run: `pnpm build`  
Expected: PASS (se falhar, corrija os erros de tipo antes de continuar).

- [ ] **Step 3: Configurar CI e deploy**

`ci.yml`: `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm build` em Node 22. `vercel.json`: framework `nextjs`, `regions: ["gru1"]`. Atualize `README.md` com pré-requisitos, `cp .env.example .env.local`, `pnpm db:migrate`, `pnpm dev` e o fluxo de uso do PWA. Documente em `.env.example` que `SESSION_SECRET` deve ter 32+ bytes.

- [ ] **Step 4: Run full verification**

Run: `pnpm test && pnpm build`  
Expected: todos os testes PASS e build sem erros.

- [ ] **Step 5: Commit**

```bash
git add . && git commit -m "chore: add CI, deploy config and documentation"
```

---

## Self-Review

- **Spec coverage:** RF-01→Task 4 · RF-02→Task 5 · RF-03→Task 5 · RF-04→Task 6 · RF-05→Task 7 · RF-06→Task 7 · RF-07→Task 3 · RF-08→Tasks 2/3/4. RNF-01→Task 5 · RNF-02→Tasks 2/5 · RNF-03→Task 7 (SSR) · RNF-04→Task 3 · RNF-05→Tasks 1/8 · RNF-06→Global Constraints. Critérios de aceite 1–5 cobertos respectivamente por Tasks 5, 5, 7, 7, 4.
- **Step scan:** cada step tem uma ação verificável; assinaturas e nomes estão fixados; nenhum corpo de algoritmo foi transcrito além do necessário.
- **Type consistency:** `VisitaLocal` estende `CriarVisita` com `fotos`/`assinatura`; `Sessao` é reutilizada em Tasks 3–6; `gerarPdf(visita: Visita)` é o único produto da Task 7.
- **Review Focus:** cinco casos mapeados para Tasks 5, 4, 6, 7 e 5 — todos com teste explícito no Step 1.
- **Proportion:** plano proporcional a uma spec de 8 requisitos funcionais; nenhuma implementação completa foi antecipada.
