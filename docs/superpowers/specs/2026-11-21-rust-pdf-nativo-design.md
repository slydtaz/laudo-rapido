# Design — Gerador de PDF em Rust nativo com fallback em JS

**Status:** aprovado pelo dono em 21/11/2026. Nada deste documento foi implementado ainda.
**Dono:** escolheu Rust nativo como caminho principal e JS como fallback.
**Fora do plano aprovado:** plano `2026-11-21-laudo-rapido-gate-producao.md` permanece autoridade sobre Tasks 1–11. Este documento cobre apenas o gerador de PDF.

## Intenção e motivo

Spike descartável em `C:\Users\MARY\AppData\Local\Temp\opencode\pdf-spike` mediu, com mesmo fixture e imagens pré-carregadas, mediana de 13,9 ms para Rust/`printpdf` contra 31,5 ms para `@react-pdf/renderer` (2,26x). O dono decidiu investigar a integração real com Rust nativo, mantendo o gerador JS atual como fallback se o código Rust falhar.

## Objetivos

- Manter `gerarPdf(visita): Promise<Uint8Array>` em `src/lib/pdf/laudo.tsx` como única interface pública. Nenhuma rota, componente ou teste muda de assinatura.
- Gerar o mesmo conteúdo do laudo: identificação do prestador, dados do cliente, capturado em, observações, galeria de fotos, assinatura e rodapé.
- Se qualquer etapa do caminho Rust falhar — carregamento do binário, chamada nativa, exception ou timeout — devolver o PDF do gerador JS sem erro para o chamador.
- Nenhuma credencial, token ou segredo em código, log ou mensagem de erro.

## Não-objetivos

- Hardware acceleration, OCR, assinatura digital criptográfica ou conformidade PDF/A.
- Tradução do PDF. Hoje `laudo.tsx` emite textos fixos em PT-BR (`Relatório de Visita`, `Dados do cliente`, `Observações`, rodapé). i18n da UI permanece como está; o PDF não entra nas chaves `ptBR/en/es/fr/de`.
- Paridade pixel-a-pixel com o layout flexbox atual. Meta: mesmo conteúdo, legível e paginado.
- Abrir mão do gate server-side existente em `GET /api/v1/visitas/[id]/pdf`. O gerador continua sendo chamado só depois de `acessoOuErro(req)`.

## Anti-objetivos (o que tornaria isso um fracasso mesmo funcionando)

- Build da Vercel passar a exigir Rust/toolchain sem fallback, quebrando deploy.
- Binário nativo sem compatibilidade com o runtime da Vercel (linux-x64-gnu / Node 20+ conforme `package.json`).
- Fallback silencioso que esconda falha repetida do Rust para sempre — precisa de sinal observável sem vazar dado.
- Ganho de performance do spike desaparecer em produção por download de fotos ou paginação.

## Restrições

- `EMAIL_PERMITIDO=macedoartur1250@gmail.com` — somente no servidor; `trim().toLowerCase()`; fail closed se ausente. `exigirAcesso()`/`acessoOuErro()` continuam sendo a única autorização.
- Cookie `sessao` opaco, 7 dias, `HttpOnly`, `SameSite=Lax`, `Secure` em produção. Formato preservado. Sem JWT.
- Service worker nunca cacheia `/api/*`, `/o/*`, `/login` nem HTML.
- Rotas públicas e bloqueadas seguem o design aprovado; nenhuma superfície nova.
- Sem push, merge ou deploy até o dono pedir explicitamente.

## Abordagens consideradas

1. **WASM pré-compilado com fallback JS.** Binário de ~5 MB versionado; `WebAssembly.instantiate` medido em ~11 ms; nenhuma toolchain no build. Rejeitada pelo dono em favor do nativo.
2. **Rust nativo com fallback JS (escolhida).** `napi-rs` expõe uma função **assíncrona** ao Node (async task/libuv), para que um timeout possa ser aplicado com `Promise.race` no lado JS; JS mantém `renderToBuffer` como plano B. Vantagem: sem custo de instantiate; desvantagem: compatibilidade de ABI/plataforma e build. Decisão do controlador: assíncrona, não síncrona — uma chamada síncrona travaria o event loop e tornaria o fallback por timeout impossível.
3. **Manter JS e otimizar o gerador atual.** Zero binário novo, mas não usa o ganho de 2,26x. Registrada como linha de base; rejeitada pelo dono.

Decisão do dono: abordagem 2. As demais ficam registradas como alternativas com o motivo da rejeição.

## Partes decididas do como

- **Interface:** `src/lib/pdf/laudo.tsx` exporta `gerarPdf` com a mesma assinatura. A implementação atual vira `gerarPdfJs` (não exportada) e é chamada pelo fallback. Nenhuma rota muda.
- **Carregamento:** import do módulo nativo é dinâmico e envolvido em `try/catch` no módulo, não no topo, para que ausência do binário não derrube o import de `laudo.tsx`.
- **Fallback:** `try { return await gerarPdfRust(visita) } catch { return gerarPdfJs(visita) }`, com timeout por `Promise.race` em torno da chamada nativa. O `catch` registra uma linha curta e fixa sem dados da visita, e-mail ou segredo. Sem `console.log` de payload.
- **Sinal observável:** sem telemetria no repo e com contador em memória perdido a cada instância serverless, a decisão do controlador é log de uma linha fixa (ex.: `pdf_engine=rust fallback=1`) no `catch`, sem dado de tenant. Kill switch por variável de ambiente `PDF_ENGINE` com valores `rust`/`js`: se ausente ou `js`, usar apenas o gerador JS. Isso permite desligar o caminho nativo sem deploy caso ele devolva PDF errado mas válido (cenário que o `catch` não pega).
- **Binário:** pré-compilar para a plataforma do runtime da Vercel e versionar o artefato `.node`, evitando toolchain Rust no build. Alvo provável: `x86_64-unknown-linux-gnu`, Node 20+. Confirmar o alvo exato com `process.platform`/`process.arch`/`process.versions.modules` no ambiente de build antes de gerar o artefato; decisão de plataforma é do builder, não do dono.
- **Contrato FFI (decisão do controlador):** JS normaliza a visita num payload plano antes de cruzar a fronteira — `dadosDoCliente`, `nomeEmpresa` e `formatarData('pt-BR')` continuam em TypeScript, produzindo `string[]` de linhas e estruturas simples. Rust recebe só esse payload serializado e desenha. Motivo: `Intl.DateTimeFormat` depende do timezone do servidor e `dados` pode conter objetos (`texto()` faz `JSON.stringify`); replicar isso em Rust geraria divergência no teste de equivalência. Assim, o teste compara os textos já normalizados, não regras de formatação duplicadas.
- **Conteúdo:** Rust gera cabeçalho, seções e linhas a partir do payload normalizado, galeria e assinatura. Quebra de página explícita quando o conteúdo exceder A4.
- **Fotos (decisão do dono):** Rust busca as URLs de fotos e assinatura diretamente, com client HTTP/TLS próprio (novas dependências e I/O de rede dentro da chamada nativa). JS passa só as strings de URL, sem pré-fetch. Motivo do dono: fidelidade ao render atual, onde o react-pdf busca durante a renderização. Consequência aceita: o benchmark passa a medir rede + decode + render juntos, e o binário cresce com as dependências TLS. O timeout da chamada nativa (ver Fallback) precisa cobrir o tempo de rede também.
- **Fixture de benchmark:** com Rust buscando URLs, o benchmark local válido exige um servidor HTTP local servindo as mesmas imagens do fixture (em vez de data URI embutida), para medir o custo real de rede. A validação com fotos R2 reais fica como passo de deploy, não como pré-requisito de implementação — deploy está proibido até o dono pedir. O resultado local é o único ganho declarável antes disso.
- **Testes:** suíte atual de PDF continua verde sem alterar assinatura. Teste novo força falha do caminho Rust e afirma que o fallback devolve PDF válido; teste de equivalência de conteúdo compara textos extraídos dos dois PDFs.
- **Segurança:** nenhuma autorização migra para o gerador. A rota de PDF continua protegida por `acessoOuErro`.

## Riscos conhecidos

- `link.exe` (MSVC) não existe nesta máquina. Build local de nativo pode exigir toolchain GNU ou cross-compile; isso é risco de desenvolvimento, não de runtime.
- ABI do Node na Vercel precisa ser confirmada antes de gerar o `.node`.
- Paginação e emplilhamento de fotos em Rust são trabalho novo, não medido pelo spike.
- O ganho de 2,26x é de microbenchmark de uma página com imagens embutidas. O dono escolheu que Rust busca as URLs, então o benchmark local precisa de servidor HTTP local para incluir custo de rede; o resultado pode cair abaixo de 2x. Validação com R2 real só após autorização de deploy. Se o ganho local cair abaixo de 2x, o dono deve decidir se mantém a abordagem.

## O que fica para o builder (após aprovação e plano)

- Escolher a versão de `napi-rs` compatível com Node 20+ e o alvo exato da Vercel (plataforma decidida pelo builder, não pelo dono).
- Definir como o artefato `.node` entra no repositório sem exceder limites e sem binário opaco não rastreável.
- Escrever o motor de layout/paginação em Rust e os testes de equivalência sobre o payload normalizado.
- Medir novamente com o fixture local servido por HTTP (Rust buscando as URLs) e reportar speedup antes de qualquer integração final.

## Aprovação

Aprovado pelo dono em 21/11/2026, incluindo Rust buscar URLs e fallback JS. Isso autoriza escrever o plano de implementação e, depois de revisado, executá-lo. Continua proibido: push, merge e deploy até pedido explícito.
