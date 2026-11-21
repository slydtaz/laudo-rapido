# Gerador de PDF em Rust nativo com fallback JS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trocar o gerador de PDF por Rust nativo mantendo `gerarPdf(visita)` idêntico, com fallback automático para `@react-pdf/renderer` e kill switch por ambiente.

**Architecture:** JS normaliza a visita num payload serializável; um binding `napi-rs` assíncrono recebe esse JSON, busca as imagens por HTTP e desenha o PDF com `printpdf`. `laudo.tsx` envolve a chamada nativa em timeout e `try/catch`; qualquer falha devolve o PDF do gerador JS. O caminho nativo só é usado quando `PDF_ENGINE=rust`.

**Tech Stack:** Rust 2024, `napi-rs` 2.x, `printpdf` 0.12.14, `reqwest` com TLS, TypeScript/Node >=22, Vitest, Next 15.

**Spec:** `docs/superpowers/specs/2026-11-21-rust-pdf-nativo-design.md` (aprovada em 21/11/2026).

**Ordem de execução:** executar **depois** que o plano `2026-11-21-laudo-rapido-gate-producao.md` (Tasks 1–11) estiver completo. Não rodar em paralelo com ele.

## Global Constraints

- `EMAIL_PERMITIDO=macedoartur1250@gmail.com` — somente no servidor; comparar com `trim().toLowerCase()`; se ausente, negar acesso (fail closed).
- Gate no servidor com `exigirAcesso()`; **não** trocar o cookie por JWT; **não** colocar e-mail ou regra de autorização no front-end.
- Cookie `sessao`: token opaco, 7 dias, `HttpOnly`, `SameSite=Lax`, `Secure` em produção. Formato preservado.
- Rotas públicas e bloqueadas seguem o design aprovado; nenhuma superfície nova.
- Nenhuma credencial, token ou segredo em chat, log, commit ou mensagem de erro. **Não ler `.env.local`.**
- Service worker nunca cacheia `/api/*`, `/o/*`, `/login` nem páginas HTML.
- Rótulos PT-BR preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`.
- Vitrine de planos mantém `Nenhuma cobrança é feita nesta versão`; nenhum campo de pagamento.
- Idiomas suportados em toda chave nova: `ptBR`, `en`, `es`, `fr`, `de` (o PDF não entra nessas chaves; textos do PDF permanecem PT-BR).
- Sem push, merge ou deploy até o dono pedir explicitamente. Commits locais apenas.
- Usar `git add <arquivos>` explícito nos commits. **Nunca `git commit -am`**: o ledger SDD do controlador fica modificado no worktree e não deve entrar nos commits de implementação.
- Comando confiável de suíte: `corepack pnpm vitest run --maxWorkers=4`. Não alterar `vitest.config.ts`.
- Node >=22 (`package.json` `engines`). Alvo nativo provável: `x86_64-unknown-linux-gnu`; confirmar no build.

## Review Focus

Estes são os casos que o spec implica e que os testes de UI/PDF atuais não cobrem. Cada linha tem seu teste na tarefa dona do código.

1. `PDF_ENGINE` ausente, vazio ou com valor desconhecido → usar somente JS, sem erro e sem log de fallback. Teste na Task 2 (`tests/pdf-fallback.test.ts`).
2. Artefato `.node` ausente ou incompatível → o import de `laudo.tsx` não quebra e `gerarPdf` devolve PDF válido pelo JS. Teste na Task 2.
3. Chamada nativa rejeita, lança ou excede o timeout de 5000 ms → fallback JS, log fixo `pdf_engine=rust fallback=1`, sem payload/e-mail/URL no log. Teste na Task 2.
4. Rust devolve PDF válido mas com conteúdo errado → `PDF_ENGINE=js` desliga o caminho nativo sem deploy. Teste na Task 2 (kill switch) e Task 4 (equivalência de conteúdo).
5. URL de foto/assinatura com HTTP não-2xx ou imagem inválida → Rust falha e o fallback JS entrega o PDF. Teste na Task 4 com servidor HTTP local.

---

### Task 1: Payload normalizado compartilhado

**Files:**
- Create: `src/lib/pdf/payload.ts`
- Create: `tests/pdf-payload.test.ts`
- Modify: `src/lib/pdf/laudo.tsx` (mover `texto`, `nomeEmpresa`, `dadosDoCliente`, `formatarData` para `payload.ts`; `Relatorio` passa a receber o payload)

**Interfaces:**
- Consumes: `Laudo` de `src/lib/pdf/laudo.tsx` (tipo permanece exportado de lá).
- Produces: `PayloadLaudo` e `normalizarPayload(visita: Laudo): PayloadLaudo` em `src/lib/pdf/payload.ts`.

```ts
export type PayloadLaudo = {
  tituloDocumento: string
  titulo: string
  marca: string
  secaoDados: string
  secaoObservacoes: string
  secaoFotos: string
  linhas: Array<[string, string]>
  observacoes: string
  fotos: string[]
  assinaturaUrl: string | null
  legendaAssinatura: string | null
  rodape: string
}
```

Valores fixos: `titulo = 'Relatório de Visita'`, `secaoDados = 'Dados do cliente'`, `secaoObservacoes = 'Observações'`, `secaoFotos = 'Fotos'`, `rodape = 'LaudoRápido — laudo de visita técnica'`, `tituloDocumento = 'Relatório de Visita - ' + visita.id`. `linhas` = resultado de `dadosDoCliente` acrescido de `['Capturado em', formatarData(visita.capturadoEm)]`. `marca` = `nomeEmpresa`. `fotos` = `visita.fotos?.map(f => f.url) ?? []`. `assinaturaUrl` e `legendaAssinatura` são `null` quando não há assinatura. `texto()`, `nomeEmpresa()`, `dadosDoCliente()` e `formatarData()` mantêm o comportamento atual de `laudo.tsx`, inclusive `Intl.DateTimeFormat('pt-BR')` e o fallback `JSON.stringify` para objetos.

- [ ] **Step 1: Write the failing test** em `tests/pdf-payload.test.ts`: com a mesma `visitaFake` de `tests/pdf.test.ts`, afirmar todos os campos de `PayloadLaudo` acima; incluir um caso com `dados: { cliente: 'X', tipo: { foo: 1 }, observacoes: 'ok', empresa: 'Ignorada' }` e outro com `nomePrestador` vazio para cobrir o fallback. Afirmar que `empresa` e `observacoes` não aparecem em `linhas`.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/pdf-payload.test.ts`
Expected: FAIL — módulo `src/lib/pdf/payload.ts` inexistente.

- [ ] **Step 3: Implement `normalizarPayload` em `src/lib/pdf/payload.ts`** e refatorar `Relatorio` em `laudo.tsx` para consumir o payload. `gerarPdfJs` (nesta task ainda chamado `gerarPdf`) continua gerando o mesmo PDF de antes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/pdf-payload.test.ts tests/pdf.test.ts`
Expected: PASS nos dois arquivos; `tests/pdf.test.ts` inalterado continua verde.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/payload.ts src/lib/pdf/laudo.tsx tests/pdf-payload.test.ts
git commit -m "refactor(pdf): normaliza payload do laudo para o gerador nativo"
```

---

### Task 2: Orquestração nativa, fallback e kill switch

**Files:**
- Create: `src/lib/pdf/native.ts`
- Create: `tests/pdf-fallback.test.ts`
- Modify: `src/lib/pdf/laudo.tsx`

**Interfaces:**
- Consumes: `PayloadLaudo`, `normalizarPayload` (Task 1).
- Produces: em `src/lib/pdf/native.ts`: `carregarModuloNativo(): Promise<NativePdfModule | null>`, `gerarPdfNativo(payload: PayloadLaudo, timeoutMs?: number): Promise<Uint8Array>`, e o tipo `NativePdfModule = { gerar_pdf(payloadJson: string): Promise<Uint8Array> }`. Em `laudo.tsx`: `gerarPdf(visita: Laudo): Promise<Uint8Array>` (mesma assinatura) e `gerarPdfJs(visita: Laudo): Promise<Uint8Array>` (exportada só para testes).

`PDF_TIMEOUT_MS = 5000`. `carregarModuloNativo` usa import dinâmico com caminho calculado a partir de `process.platform`, `process.arch` e `process.versions.modules`, envolvido em `try/catch`; devolve `null` em vez de lançar. Caminho do artefato: `native/laudo-pdf.<plataforma>.node` na raiz do repo. `gerarPdfNativo` serializa o payload com `JSON.stringify` e aplica `Promise.race` com o timeout.

Regras de `gerarPdf`: se `process.env.PDF_ENGINE !== 'rust'`, chamar diretamente `gerarPdfJs`. Com `rust`, tentar `gerarPdfNativo`; em qualquer rejeição (inclusive timeout ou módulo ausente), registrar exatamente uma linha `console.warn('pdf_engine=rust fallback=1')` e chamar `gerarPdfJs`. Nenhum outro dado na linha de log. Sem `console.log` de payload.

- [ ] **Step 1: Write the failing tests** em `tests/pdf-fallback.test.ts`, mockando `src/lib/pdf/native.ts` com `vi.mock`:
  - `PDF_ENGINE` ausente → `gerarPdfNativo` não é chamado e o PDF vem do JS.
  - `PDF_ENGINE='js'` e `PDF_ENGINE='qualquer'` → mesmo resultado.
  - `PDF_ENGINE='rust'` com `carregarModuloNativo` devolvendo `null` → PDF do JS, um `console.warn` com a linha fixa.
  - `gerarPdfNativo` rejeitando → PDF do JS e a mesma linha de log.
  - `gerarPdfNativo` que nunca resolve → fallback após o timeout (usar `vi.useFakeTimers()` com `PDF_TIMEOUT_MS`, ou injetar `timeoutMs = 10` na chamada de teste).
  - espião de `console.warn` afirmando que a linha não contém e-mail, id da visita nem URL.
  Restaurar `process.env.PDF_ENGINE` e os mocks em `afterEach`.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/pdf-fallback.test.ts`
Expected: FAIL — `gerarPdfNativo`/`carregarModuloNativo` inexistentes e `PDF_ENGINE` ignorado.

- [ ] **Step 3: Implement `src/lib/pdf/native.ts` e a orquestração em `laudo.tsx`** conforme as interfaces e regras acima. Renomear a implementação JS atual para `gerarPdfJs` e mantê-la exportada.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/pdf-fallback.test.ts tests/pdf.test.ts tests/pdf-payload.test.ts`
Expected: PASS nos três arquivos.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/native.ts src/lib/pdf/laudo.tsx tests/pdf-fallback.test.ts
git commit -m "feat(pdf): fallback js e kill switch para o gerador nativo"
```

---

### Task 3: Crate Rust e binding napi-rs

**Files:**
- Create: `native/laudo-pdf/Cargo.toml`
- Create: `native/laudo-pdf/src/lib.rs`
- Create: `native/laudo-pdf/package.json`
- Create: `.gitignore` (entrada para artefatos de build do crate, se ainda não houver regra)
- Test: `tests/pdf-native.test.ts`

**Interfaces:**
- Consumes: `PayloadLaudo` (Task 1) — o contrato é o JSON serializado desse tipo.
- Produces: módulo nativo com `gerar_pdf(payloadJson: string): Promise<Uint8Array>`; artefato `native/laudo-pdf.<plataforma>.node` na raiz do repo (copiado pelo build).

`Cargo.toml`: `edition = "2024"`, `crate-type = ["cdylib"]`, dependências `napi` 2.x com features `napi3` e `tokio_rt`, `napi-derive` 2.x, `tokio` com `rt-multi-thread`, `printpdf = 0.12.14` com `default-features = false, features = ["images", "png"]`, `reqwest` com TLS e `serde`/`serde_json`. A função Rust é `pub async fn gerar_pdf(payload_json: String) -> Result<Buffer>` anotada com `#[napi]`; recebe o JSON, busca cada URL de `fotos` e `assinaturaUrl` com `reqwest`, decodifica com `RawImage::decode_from_bytes`, e devolve um PDF A4 mínimo contendo `titulo`, `marca` e cada `linha`. `package.json` do crate usa o CLI `napi build --platform --release` e copia o `.node` para `native/` na raiz do repo.

Esta task **não** implementa layout final — apenas prova que o binding carrega, busca imagem por HTTP e devolve bytes PDF válidos.

- [ ] **Step 1: Write the failing test** em `tests/pdf-native.test.ts`: subir um servidor `node:http` local servindo `public/icon-192.png` e `public/icon-512.png`; montar um `PayloadLaudo` válido com as URLs locais; chamar `gerarPdfNativo` (com `PDF_ENGINE` irrelevante, chamada direta) e afirmar que os bytes começam com `%PDF-` e excedem 1000 bytes. Usar `describe.skipIf(!existeArtefatoHost())`, onde `existeArtefatoHost()` verifica `native/laudo-pdf.<plataforma>.node`. Fechar o servidor em `afterAll`.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/pdf-native.test.ts`
Expected: SKIP (sem artefato ainda) e falha de import se o módulo for referenciado sem guarda. Registrar o skip como esperado.

- [ ] **Step 3: Implement o crate e o script de build** conforme acima. Compilar para o host com a toolchain disponível. Se `link.exe`/MSVC falhar, usar `cargo +stable-x86_64-pc-windows-gnu build --release` com a configuração `.cargo/config.toml` do crate; se ainda falhar, reportar BLOCKED com o comando e o erro exatos. **Não** substituir por WASM nem inventar artefato.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/pdf-native.test.ts`
Expected: PASS com o artefato host presente; o teste deixa de ser skipado.

- [ ] **Step 5: Commit**

```bash
git add native/laudo-pdf/Cargo.toml native/laudo-pdf/src/lib.rs native/laudo-pdf/package.json .gitignore tests/pdf-native.test.ts
git commit -m "feat(pdf): crate rust com binding napi-rs assincrono"
```

O artefato `.node` compilado no host fica ignorado pelo Git nesta task; será tratado na Task 5.

---

### Task 4: Layout, paginação e equivalência de conteúdo

**Files:**
- Modify: `native/laudo-pdf/src/lib.rs`
- Modify: `tests/pdf-native.test.ts`

**Interfaces:**
- Consumes: `PayloadLaudo` (Task 1), binding da Task 3.
- Produces: mesmo `gerar_pdf(payloadJson)` com conteúdo completo.

Implementar no Rust: cabeçalho com `marca` e `titulo`; seção `secaoDados` com cada par de `linhas`; linha `Capturado em` já normalizada; seção `secaoObservacoes` com `observacoes`; seção `secaoFotos` com as imagens buscadas por HTTP; bloco de assinatura quando `assinaturaUrl` não é nulo, com `legendaAssinatura`; `rodape` fixo. Quebra de página explícita quando o conteúdo exceder A4. Usar fonte embutida padrão do `printpdf`; textos PT-BR com acentos devem ser gravados em WinAnsi/Latin-1.

- [ ] **Step 1: Write the failing tests** em `tests/pdf-native.test.ts`, acrescentando:
  - equivalência: para a `visitaFake`, `textoDesenhado` aplicado ao PDF do Rust contém `OficinaCentral`, `PadariaCentral`, `HVAC`, `Serviçoconduzido`, `Dadosdocliente`, `Observações`, `Fotos` e `LaudoRápido` — usar um extrator que decodifique tanto strings hexadecimais quanto literais de fluxos inflados, comparando em UTF-8 e Latin-1;
  - `assinaturaUrl` nula → PDF válido e sem a legenda no texto desenhado;
  - URL com resposta 404 do servidor local → `gerarPdfNativo` rejeita (o fallback da Task 2 já cobre a entrega do PDF pelo JS);
  - observações longas (800 caracteres) → PDF com mais de uma página (contar occurrences de `/Type /Page` no bruto).

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/pdf-native.test.ts`
Expected: FAIL — conteúdo ausente e sem paginação.

- [ ] **Step 3: Implement o layout no Rust** conforme acima.

- [ ] **Step 4: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/pdf-native.test.ts tests/pdf.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add native/laudo-pdf/src/lib.rs tests/pdf-native.test.ts
git commit -m "feat(pdf): layout e paginacao no gerador rust"
```

---

### Task 5: Artefato de produção e inclusão no build Next

**Files:**
- Modify: `next.config.ts`
- Create: `native/laudo-pdf.linux-x64-gnu.node` (artefato versionado)
- Modify: `tests/pdf-native.test.ts` (assersão de configuração)

**Interfaces:**
- Consumes: crate da Task 4.
- Produces: artefato `.node` versionado e configuração que o inclui no output do Next.

Compilar o crate para o alvo do runtime de produção e copiar o `.node` para a raiz `native/`. Confirmar alvo com `process.platform`, `process.arch` e `process.versions.modules` no ambiente de build disponível; não assumir que o host Windows é o alvo da Vercel. Em `next.config.ts`, acrescentar `outputFileTracingIncludes` para a rota `/api/v1/visitas/[id]/pdf` incluindo `./native/**`, sem remover os cabeçalhos de segurança já configurados.

- [ ] **Step 1: Write the failing test** em `tests/pdf-native.test.ts`: importar `nextConfig` e afirmar que `nextConfig.outputFileTracingIncludes` contém uma chave para a rota de PDF cujo valor inclui `./native/**`; afirmar que `nextConfig.headers` ainda é função e que a CSP mantém `default-src 'self'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/pdf-native.test.ts`
Expected: FAIL — `outputFileTracingIncludes` ausente.

- [ ] **Step 3: Compilar o artefato e ajustar `next.config.ts`**. Se não for possível produzir o binário linux-x64-gnu nesta máquina, reportar BLOCKED com comando e erro exatos; **não** versionar binário de plataforma errada nem substituir por WASM.

- [ ] **Step 4: Run tests and build**

Run: `corepack pnpm vitest run tests/pdf-native.test.ts && corepack pnpm build`
Expected: PASS no teste e no build.

- [ ] **Step 5: Commit**

```bash
git add next.config.ts native/laudo-pdf.linux-x64-gnu.node tests/pdf-native.test.ts
git commit -m "feat(pdf): artefato nativo e tracing do build next"
```

---

### Task 6: Benchmark com servidor HTTP local e decisão de ganho

**Files:**
- Create: `scripts/bench-pdf.cjs`
- Create: `docs/benchmarks/2026-11-21-rust-pdf-local.md`

**Interfaces:**
- Consumes: `gerarPdfJs`, `gerarPdfNativo` e `normalizarPayload`.
- Produces: relatório com medianas e speedup. Nenhuma mudança de comportamento em produção.

O script sobe um servidor `node:http` servindo `public/icon-192.png` e `public/icon-512.png`, monta o mesmo `PayloadLaudo` da `visitaFake`, faz 2 aquecimentos e 10 medições de cada gerador, imprime JSON com `rust.median_ms`, `js.median_ms`, `speedup` e tamanho do binário. O lado JS recebe as mesmas URLs (o react-pdf busca por HTTP), não data URI.

- [ ] **Step 1: Write the check** em `scripts/bench-pdf.cjs`: além do JSON, o script escreve `docs/benchmarks/2026-11-21-rust-pdf-local.md` com a tabela de medianas, o comando exato usado e a data.

- [ ] **Step 2: Run to verify it measures both paths**

Run: `node scripts/bench-pdf.cjs`
Expected: JSON com duas medianas positivas e `speedup` calculado; nenhum `NaN`.

- [ ] **Step 3: Registrar a decisão no relatório**: se `speedup >= 2`, recomendar manter `PDF_ENGINE=rust` na configuração de deploy (a ser feita pelo dono); se `< 2`, recomendar manter o padrão JS e registrar que o dono deve decidir. Não alterar `PDF_ENGINE` em código nem em `.env`.

- [ ] **Step 4: Run full verification**

Run: `corepack pnpm vitest run --maxWorkers=4`
Expected: PASS na suíte completa; `tsc --noEmit` pode continuar com os erros pré-existentes em arquivos de teste não tocados; `corepack pnpm build` PASSA.

- [ ] **Step 5: Commit**

```bash
git add scripts/bench-pdf.cjs docs/benchmarks/2026-11-21-rust-pdf-local.md
git commit -m "docs(pdf): benchmark local do gerador rust"
```

---

### Task 7: Revisão final da branch

**Files:** nenhum código novo. Atualizar o ledger SDD do controlador.

- [ ] **Step 1:** gerar pacote de revisão com `git log`/`git diff` desde o commit anterior ao início deste plano e despachar um revisor fresco com as global constraints e a spec.
- [ ] **Step 2:** corrigir quaisquer achados Critical/Important e reenviar ao revisor.
- [ ] **Step 3:** rodar `corepack pnpm vitest run --maxWorkers=4` e `corepack pnpm build`; anexar as saídas ao relatório final.
- [ ] **Step 4:** escrever relatório em `.superpowers/sdd/2026-11-21-rust-pdf-nativo/relatorio-final.md` com commits, resultados, speedup medido, riscos remanescentes e a lista exata de variáveis de ambiente que o dono precisa configurar na Vercel (sem valores).
- [ ] **Step 5:** não fazer push, merge nem deploy. Entregar o relatório ao dono.
