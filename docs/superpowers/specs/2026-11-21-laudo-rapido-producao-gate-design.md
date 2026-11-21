# LaudoRápido — gate de produção, PWA e dados dinâmicos

Data: 21/11/2026
Status: aguardando aprovação do dono do produto
Auditoria de referência: `docs/superpowers/reports/2026-11-21-laudo-rapido-auditoria-seguranca.md`

## Intenção

Publicar o LaudoRápido na Vercel como uma versão **privada**, utilizável somente por `macedoartur1250@gmail.com`. Qualquer outra pessoa — mesmo autenticada com outra conta Google — deve ver uma tela dizendo que o aplicativo ainda está em desenvolvimento. O produto continua offline-first, com login real via Google, e passa a entregar três formas de atualização dinâmica: novo deploy no PWA, dados atualizando sozinhos e textos/planos editáveis sem rebuild.

O motivo é reduzir a superfície de exposição antes de abrir o produto: menos código no navegador decidindo quem pode entrar, e nenhuma confiança em arquivo salvo no aparelho para autorização ou cobrança.

## Objetivos

1. Exigir sessão válida e allowlist em **todas** as páginas e APIs, exceto o mínimo necessário para entrar.
2. Mandar qualquer outro visitante para `/em-desenvolvimento`.
3. Manter o cookie opaco atual e a validação authoritative no banco.
4. Avisar sobre novo deploy no PWA e atualizar sem apagar visitas locais.
5. Atualizar a lista de visitas sozinha, sem recarregar.
6. Permitir alterar textos e planos sem novo build.
7. Rejeitar payload local adulterado e limitar força bruta.
8. Entregar ao dono apenas a lista de variáveis e passos que ele precisa executar.

## Não-objetivos

- Cobrança, assinatura paga ou gateway de pagamento. A vitrine de planos continua estática e com `Nenhuma cobrança é feita nesta versão`.
- Login em `/em-desenvolvimento`, `/login` ou no callback OAuth — sem isso ninguém consegue entrar.
- WebSocket, SSE ou infraestrutura em tempo real com custo fixo.
- Trocar o formato do cookie de sessão ou adicionar JWT.

## Anti-objetivos (o que seria uma falha mesmo funcionando)

- Colocar o e-mail permitido, ou qualquer regra de autorização, em código entregue ao navegador.
- Confiar em `empresaId`, `status`, plano ou `assinatura` vindos do aparelho.
- Fazer o service worker cachear HTML de página bloqueada ou dado de tenant.
- Pedir segredo em chat ou gravá-lo em log, commit ou mensagem de erro.

## Restrições descobertas no código

- `src/middleware.ts` só checa presença do cookie; `lerSessao` (`src/lib/auth/session.ts:55`) valida no banco e devolve `{ usuarioId, empresaId }` — sem e-mail.
- `vincularOuCriarGoogle` cria conta para qualquer e-mail; o callback redireciona para `/` (`google/callback/route.ts:77`), que passará a ser tela de bloqueio.
- `sw.js` cacheia `/` e `/visitas/nova` como app shell; `RegistradorSW` não reage a atualizações.
- `/visitas/page.tsx:51-73` já isola o carregamento da lista em `carregar()`, o que facilita o polling.
- `useT()` lê somente `IDIOMAS_TEXTOS` (`src/lib/i18n/useT.ts:20`); planos em `/planos` usam chaves `ChaveTexto`.
- Não há remote Git configurado; deploy será feito pela Vercel CLI a partir da worktree local.
- Cookies já têm `HttpOnly`, `SameSite=Lax`, `Secure` em produção (`cookie.ts:25-35`).

## Abordagens consideradas — gate

| Abordagem | Como funciona | Trade-off |
|---|---|---|
| **Gate no servidor com route groups (escolhida)** | Grupo `(publico)` com `/login`, callback, health e `/em-desenvolvimento`; grupo `(app)` com o resto. `exigirAcesso()` usa `lerSessao` + e-mail do usuário + `EMAIL_PERMITIDO`. Middleware só faz o desvio rápido. | Uma fonte de verdade, sem mudar cookie, sem crypto no Edge. Custo: mover pastas e trocar `lerSessao` por `exigirAcesso` nas APIs. |
| Gate no Edge com JWT assinado | Cookie passa a conter e-mail; middleware valida assinatura com Web Crypto. | Barra antes de renderizar, mas invalida sessões atuais, exige nova chave secreta e ainda depende do banco para revogação. |
| Gate duplo (JWT + servidor) | As duas camadas. | Dois lugares para divergir e depurar; descartado. |

## Decisões

### 1. Allowlist e helper

- Nova variável de ambiente **somente no servidor**: `EMAIL_PERMITIDO=macedoartur1250@gmail.com`.
- Novo helper `exigirAcesso(req)` em `src/lib/auth/`: chama `lerSessao`, consulta `usuarios.email` pelo `usuarioId` da sessão (comparação via cast de uuid para texto, sem alterar o schema) e compara com `EMAIL_PERMITIDO` usando `trim().toLowerCase()`.
- Retorno: `{ usuarioId, empresaId, email } | null`. Se `EMAIL_PERMITIDO` não estiver definido, **negar acesso** (fail closed) e registrar erro no servidor — sem expor o valor.
- Todas as APIs de dados trocam `lerSessao` por `exigirAcesso`. O helper devolve `403 { erro: 'Aplicativo em desenvolvimento.' }` para e-mail não permitido e mantém `401`/`ERRO_SESSAO` para sessão inválida.
- O layout do grupo `(app)` chama `exigirAcesso` e redireciona para `/em-desenvolvimento` em caso de falha.

### 2. Rotas

- **Públicas:** `/em-desenvolvimento`, `/login`, `/esqueci-senha`, `/redefinir-senha`, `/verificar-email`, `/offline`, `/api/health`, `/api/v1/auth/login`, `/api/v1/auth/verificar`, `/api/v1/auth/verificar/reenviar`, `/api/v1/auth/senha/esqueci`, `/api/v1/auth/senha/redefinir`, `/api/v1/auth/google`, `/api/v1/auth/google/callback`, `/api/v1/auth/logout`, `/sw.js`, `/manifest.webmanifest`, ícones e assets do Next.
- **Bloqueadas:** `/`, `/planos`, `/registro`, `/o/:token`, `/configuracoes`, `/conta`, `/visitas/*`, `/api/v1/auth/registro`, `/api/v1/auth/demo-links`, `/api/v1/auth/google/demo` e todas as APIs de dados/configuração.
- Decisão do dono: **Google e e-mail/senha são os dois caminhos de entrada**. As páginas e APIs de recuperação/verificação precisam ser públicas para cumprir esse papel. `/registro` continua bloqueado — nenhuma conta nova é criada pelo formulário público; a conta de `macedoartur1250@gmail.com` é criada no primeiro login Google ou por seed local, e a senha pode ser definida depois em `/conta`.
- Atenção: só o modo demo (`demo-links`, `google/demo`) responde `404` em produção; o Google sem credenciais responde `503`. As rotas de senha continuam implementadas e funcionando — não são desligadas em produção.
- Middleware: sem cookie em rota protegida → `307 /em-desenvolvimento` para página, `403` JSON para `/api/*`. Com cookie, deixa a validação real acontecer no servidor.
- `/login` (página pública) chama `exigirAcesso`: sessão permitida → `/visitas`; sessão de outro e-mail → `/em-desenvolvimento`; sem sessão → mostra o formulário.
- Callback OAuth passa a redirecionar para `/visitas` em vez de `/`.

### 3. Tela “em desenvolvimento”

- Rota `/em-desenvolvimento`, estática, sem formulário e sem link para login. Texto: “Aplicativo em desenvolvimento — estamos finalizando esta versão. Volte em breve.”
- Elementos visuais do tema claro/escuro e i18n; chaves novas em pt-BR, en, es, fr e de.
- `/offline`: mesma estética, texto “Sem conexão. Suas visitas salvas continuam no aparelho.”
- Consequência aceita pelo dono: o cliente não abre mais o laudo por `/o/:token`.

### 4. Dados locais e campo “assinatura: Paga”

- `criarVisitaSchema` passa a usar `.strict()` no objeto raiz e em `dados`. Campo extra → HTTP 400 com mensagem genérica.
- Testes garantem que `empresaId`, `status`, `plano` e `assinatura` enviados no corpo nunca chegam ao banco: o tenant vem da sessão e o status é fixado pelo servidor.
- Nenhum campo de pagamento é criado; `assinaturas` continua sendo apenas a imagem da assinatura do cliente.
- MIME e tamanho de fotos/assinatura continuam validados no servidor em `storage/client.ts`.

### 5. XSS e cabeçalhos

- Manter React escapando tudo; nenhum novo `dangerouslySetInnerHTML`. O único atual permanece estático em `layout.tsx`.
- `next.config.ts` passa a exportar `headers()` com:
  - `Content-Security-Policy`: `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com; frame-src 'self' data: blob:`
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`.
- Observação registrada: `'unsafe-inline'` ainda é necessário por causa dos scripts inline do Next e do tema; a CSP reduz exfiltração, não elimina XSS de script inline.
- Força bruta: nova tabela `tentativas_login` (chave `ip + e-mail`, `criadoEm`) e bloqueio após 10 tentativas em 15 minutos em `/login` e `/senha/esqueci`, com `429`.

### 6. Atualização dinâmica do PWA

- `sw.js`: versão `v4`, cache somente de assets (`/manifest.webmanifest`, ícones, `/_next/static/*`); remover `/` e páginas HTML do `SHELL` e da função `eShell`. Navegação offline usa `/offline`.
- SW escuta `message` com `{ type: 'SKIP_WAITING' }` e chama `skipWaiting()`.
- `RegistradorSW`: após `register()`, ouvir `updatefound`; quando o worker instalado estiver `installed`, avisar “Nova versão disponível” com ação “Atualizar” via `useToast`; ao confirmar, enviar `SKIP_WAITING`; em `controllerchange`, recarregar a página uma vez.
- IndexedDB das visitas não é apagado em nenhum desses passos.

### 7. Dados em tempo real

- Extrair o carregamento de `/visitas` para um hook `useVisitas()` com `carregar()` atual.
- `setInterval` de 30 s, só quando `document.visibilityState === 'visible'` e `navigator.onLine`; abortar requisição pendente no cleanup e não exibir skeleton no refreshes silenciosos.
- Indicador discreto “Atualizado às HH:mm” com nova chave i18n.
- Decisão de escopo: a home continua atualizando o resumo ao montar e nos eventos `online`/`offline`; polling nela seria trabalho duplicado.

### 8. Textos e planos sem rebuild

- Nova tabela `configuracao_app`: `chave text primary key`, `valor jsonb not null`, `atualizadoEm timestamp`.
- `GET /api/v1/configuracao` (autenticado, `no-store`) devolve `{ versao, textos, planos }`; `PUT` só para o e-mail permitido, com Zod limitando chaves a `ChaveTexto` conhecidas e planos a um formato fixo.
- `ProvedorConfiguracao` busca no mount e aplica overrides sobre `IDIOMAS_TEXTOS[idioma]` por idioma; `useT()` consulta o override primeiro e cai para o dicionário local se a API falhar.
- Decisão do dono: **edição numa tela**, não só via chamada manual. `/configuracoes` ganha uma seção “Conteúdo” com edição de textos por idioma e de planos (nome, preço, dica, itens), salvando pelo `PUT /api/v1/configuracao`. Nada de HTML livre: apenas campos de texto validados e escapados pelo React.
- `/planos` consome a lista devolvida pela API, mantendo o aviso de sem cobrança como texto padrão. React escapa todo o conteúdo; nada é inserido como HTML.
- Sem cache de `/api/*` no service worker (regra já existente, preservada).
- `ProvedorConfiguracao` é montado **somente no grupo `(app)`**: o GET é autenticado, então `/login`, `/em-desenvolvimento` e `/offline` continuam usando o dicionário local. A tela de bloqueio não é editável sem rebuild — decisão aceita para manter as páginas públicas simples e sem chamada de API.

### 9. OAuth e credenciais

- Fluxo Google real (PKCE + JWKS) já implementado: `/api/v1/auth/google` → consentimento → `/api/v1/auth/google/callback`.
- Login por senha e recuperação continuam ativos por decisão do dono: `EMAIL_WEBHOOK_URL` precisa ser configurada na Vercel para o e-mail de redefinição chegar.
- `GOOGLE_REDIRECT_URI` deve ser `https://<domínio-vercel>/api/v1/auth/google/callback`.
- Modo demo continua desligado em produção (`503`/`404`).
- Nenhuma credencial é digitada no chat: o dono configura as variáveis no terminal dele (`vercel env add NOME production`) ou no painel da Vercel.

### 10. Deploy

1. Dono: `vercel login` no terminal, na pasta da worktree.
2. Eu: `vercel link` para ligar a pasta ao projeto; `vercel env add` para cada variável, com o dono digitando os valores.
3. Eu: `vercel --prod` a partir da worktree (não há remote Git).
4. Verificação: `/api/health` → 200; `/planos` e `/o/qualquercoisa` → `/em-desenvolvimento`; `/login` → formulário; entrada com o e-mail permitido → `/visitas`.
5. Rollback: `vercel rollback` para o deploy anterior.

### 11. Testes

- Testes unitários/integração (Vitest): allowlist aceita/rejeita e fail closed; middleware redireciona página e devolve 403 em API; `.strict()` rejeita campo extra; rate limit 429; config API valida chaves; SW não lista páginas bloqueadas no cache.
- Smoke com os rótulos PT-BR preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`.
- Portas de saída: `pnpm test`, `pnpm build`, smoke manual no preview antes do `vercel --prod`.
- Relatório final de auditoria atualizado com o estado de cada achado após as correções.

## O que fica para o builder

- Nomes exatos de arquivos, migrações e funções seguem o padrão existente (`src/lib/auth/*`, `src/lib/db/schema.ts`, `drizzle/`).
- A escolha de fazer join/cast para buscar o e-mail em vez de desnormalizá-lo na sessão é uma decisão deste desenho: sem migração de dados além das duas tabelas novas.
- Chaves i18n novas devem ser adicionadas nos cinco idiomas; textos de fallback seguem o dicionário pt-BR.
- Domínios reais de Supabase/R2 na CSP devem ser confirmados no código de configuração sem imprimir valores secretos.
- Nenhuma dependência nova é necessária para rate limit, polling ou PWA; a menos que um teste mostre o contrário.

## Chamadas fechadas na revisão de builder

- **Banco:** o deploy aponta para o mesmo Supabase já usado pelo projeto (`DATABASE_URL`). A Vercel não executa migrações; eu aplico as duas tabelas novas com o script local existente, usando a `DATABASE_URL` configurada, e peço confirmação antes de rodar contra produção.
- **Projeto Vercel:** `vercel link` cria o projeto se ele não existir. O domínio será o `*.vercel.app` gerado; você cadastra esse mesmo domínio na URI de redirecionamento autorizada do Google. Nenhum domínio próprio é assumido.
- **Provedor de configuração:** montado só nas páginas autenticadas, como registrado na seção 8.
- **Rotas de senha:** mantidas como segundo caminho de entrada por decisão do dono; recuperação e verificação são públicas, cadastro continua bloqueado.
- **Edição de conteúdo:** tela em `/configuracoes` por decisão do dono, com salvamento pela API autenticada.

## Chamadas do builder para conferir na leitura

- Gate no servidor com route groups, não JWT no Edge.
- Allowlist por `EMAIL_PERMITIDO` no servidor, fail closed se a variável faltar.
- `/o/:token` bloqueado — o cliente não abre o PDF pelo link.
- Polling de 30 s só em `/visitas`; a home continua como está.
- Sem WebSocket e sem dependências novas.
- A tela “em desenvolvimento” não tem link para login nem conteúdo editável sem rebuild.
- O editor de conteúdo fica em `/configuracoes`, restrito ao e-mail permitido.

## Riscos e rollback

- **Risco:** mover pastas quebra imports absolutos. Mitigação: `@/` aponta para `src`; rodar `pnpm build` logo após o movimento.
- **Risco:** cache antigo do SW serve `/` bloqueado. Mitigação: bump da versão do cache e remoção das páginas HTML.
- **Risco:** login Google cria conta de outro e-mail e a pessoa fica presa na tela. Mitigação esperada e aceita; a sessão é criada, mas `exigirAcesso` barra.
- **Rollback:** commits locais reversíveis; `vercel rollback` se algo passar.
