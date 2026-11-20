# Design: login completo + OAuth com Google — LaudoRápido

Data: 2026-11-20
Base: `1b72a9f` (branch `feature/laudo-rapido-mvp`)
Status: aprovado pelo escopo escolhido pelo usuário; execução contínua sem checkpoints entre tasks.

## Intenção

O app já entra com e-mail/senha, mas não tem onboarding nem recuperação de conta, e não oferece login com Google. O usuário quer um fluxo de autenticação completo para que uma pessoa consiga criar conta, confirmar o e-mail, recuperar o acesso, cuidar do próprio perfil e entrar com a conta do Google — sem perder o comportamento offline-first, os cinco idiomas ou as rotas já testadas.

## Goals

- Cadastro de conta com empresa, e-mail e senha.
- Verificação de e-mail com token de uso único.
- "Esqueci minha senha" com token de uso único e invalidação das sessões antigas.
- Tela "Minha conta" com dados basics e troca de senha.
- Login com Google via Authorization Code + PKCE, reaproveitando o cookie `sessao` atual.
- Modo demo local para exercitar o OAuth inteiro sem credenciais do Google.
- Documentação clara de quais variáveis preencher e qual redirect URI autorizar.

## Non-goals

- Migrar para Supabase Auth ou trocar o modelo de sessão próprio.
- Enviar e-mail de verdade nesta entrega (o remetente é pluggável; em dev o link aparece na tela).
- Bloquear o acesso ao app até o e-mail ser verificado.
- Aceitar outros provedores (Apple, Microsoft etc.).
- Permitir alterar o e-mail da conta (e-mail é a chave de vínculo com o Google).
- Mexer em planos, cobrança ou limites.

## Anti-goals

- Quebrar os rótulos PT-BR usados por smoke (`Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`).
- Expor Client Secret, tokens ou hashes em resposta, log ou bundle do cliente.
- Criar um segundo sistema de sessão convivendo com o cookie `sessao`.
- Fazer o modo demo aceitar login em produção.

## Constraints

- Next.js 15 App Router, Drizzle ORM, postgres-js em produção e PGlite nos testes.
- Migrações SQL escritas à mão em `migrations/*.sql`, aplicadas por `src/lib/db/migrar.ts`.
- Middleware roda no Edge e não pode consultar o banco.
- Sessão atual: token opaco de 32 bytes no cookie HttpOnly `sessao`, 7 dias, `SameSite=Lax`, `Secure` em produção.
- Senhas com Argon2 (`src/lib/auth/password.ts`).
- Cinco idiomas em `src/lib/i18n/dicionario.ts`; tema claro/escuro/sistema; PWA/offline preservados.
- Ainda não há credenciais do Google Cloud; o modo demo é obrigatório para validar o fluxo agora.

## Abordagens consideradas

1. **OAuth próprio com PKCE sobre as tabelas atuais (escolhida).** O app emite o `state`, guarda o `code_verifier` em cookie HttpOnly, troca o código pelo `id_token` do Google, valida assinatura e claims, cria ou vincula o usuário e chama o mesmo `criarSessao()` do login. Vantagem: zero mudança em middleware, `/api/v1/sessao`, fila offline ou PWA. Custo: implementar PKCE, JWKS e o vínculo por e-mail verificado com cuidado.
2. **Supabase Auth com provedor Google.** O Google é gerenciado pelo Supabase, mas o app passa a ter JWT do Supabase e cookie `sessao` ao mesmo tempo. Exige adaptar middleware, rotas de API, leitura de tenant e o fluxo offline, além de migrar usuários existentes. Mais risco e mais trabalho para o mesmo resultado.
3. **Só provedor demo, sem código real.** Barato e imediato, mas não entrega login com Google de fato; serve apenas como complemento da opção 1, não como substituto.

A opção 1 foi escolhida porque preserva a arquitetura que já passou por smoke e auditoria. A opção 3 entra como modo de teste dentro da opção 1.

## Decisões de implementação

### Migração `0003_auth.sql`

- `usuarios.nome text` — nome exibido no perfil; para conta Google vem do `name` do perfil.
- `usuarios.google_sub text` com índice único — `sub` do Google; múltiplos valores nulos são aceitos pelo Postgres.
- `usuarios.email_verificado_em timestamp` — preenchido pelo Fluxo de verificação ou automaticamente no Google (somente quando `email_verified` for `true`).
- Nova tabela `tokens_auth`: `id text` (hash SHA-256 do token bruto), `usuario_id uuid` com FK para `usuarios`, `tipo text` com check em (`verificar_email`, `redefinir_senha`), `expira_em timestamp`, `usado_em timestamp`, `criado_em timestamp default now()`.
- `sessoes` continua sem FK, como credencial.

### Serviços

- `src/lib/auth/cookie.ts`: centraliza `definirCookieSessao`, `expirarCookieSessao` e o cookie temporário `oauth` (somente state + verifier, HttpOnly, 10 min). Hoje a montagem do cookie está duplicada na rota de login; vai virar helper único.
- `src/lib/auth/tokens.ts`: gera token opaco, guarda só o hash, consome uma vez, valida expiração (30 min para redefinição, 24 h para verificação) e aplica cooldown de 60 s por e-mail/tipo para evitar abuso.
- `src/lib/auth/email.ts`: interface `EnviadorEmail`. Em desenvolvimento sem provedor, devolve o link/token na resposta e mostra na tela, com aviso explícito de que é modo demo. Em produção, usa `EMAIL_WEBHOOK_URL` se configurado; se não estiver, a solicitação responde `202` genérico e **não** registra token em log.
- `src/lib/auth/google.ts`: monta a URL de autorização com `code_challenge` S256, troca o código no endpoint de token, busca JWKS em `https://www.googleapis.com/oauth2/v3/certs` (cache em memória curto) e valida `iss`, `aud`, `exp` e `email_verified`. Nunca confia em e-mail não verificado.
- `src/lib/auth/conta.ts`: operações de domínio (`criarContaComSenha`, `vincularOuCriarGoogle`, `verificarEmail`, `redefinirSenha`, `atualizarNome`, `trocarSenha`). Toda troca de senha apaga as sessões do usuário, menos a atual quando aplicável. `vincularOuCriarGoogle` vincula apenas quando o `email_verified` do Google **e** o `emailVerificadoEm` local estão presentes; conta local existente e não verificada recebe recusa com caminho de recuperação (entrar com senha, verificar e-mail, tentar de novo), nunca é vinculada nem marcada como verificada. Conta nova criada pelo Google recebe `empresas.nome = "Minha empresa"` e `usuarios.nome` vindo do perfil; ambos editáveis em `/conta`.

### Rotas

| Método | Rota | Comportamento |
| --- | --- | --- |
| POST | `/api/v1/auth/registro` | Valida nome/e-mail/senha, cria empresa + usuário, emite token de verificação, responde `201` com estado "verifique seu e-mail". Não cria sessão. |
| POST | `/api/v1/auth/verificar` | Consome token, marca `emailVerificadoEm`, responde `200`. Token inválido/usado → `400`. |
| POST | `/api/v1/auth/verificar/reenviar` | Sempre `202` genérico. |
| POST | `/api/v1/auth/senha/esqueci` | Sempre `202` genérico; emite token se o e-mail existir. |
| POST | `/api/v1/auth/senha/redefinir` | Consome token, troca hash Argon2, apaga sessões antigas, responde `200`. |
| GET | `/api/v1/auth/google` | Redireciona para o Google com PKCE; sem credenciais em dev redireciona para o consentimento demo; sem credenciais em produção responde `503`. |
| GET | `/api/v1/auth/google/callback` | Valida state, troca código, valida id_token, cria/vincula usuário, cria sessão e redireciona para `/`. |
| GET | `/api/v1/auth/google/demo` | Tela de consentimento simulada, claramente rotulada como demo, apenas fora de produção. Usa identidade fixa `demo.google@exemplo.local`, `sub` `google-demo-sub`, nome `Técnico Demo`. |
| GET | `/api/v1/conta` | Dados não sensíveis: nome, e-mail, empresa, verificado, provedor, criação. |
| PATCH | `/api/v1/conta` | Atualiza nome do usuário e da empresa. |
| POST | `/api/v1/conta/senha` | Troca de senha: exige senha atual para conta com senha; para conta Google exige e-mail verificado. |

Todas as rotas novas de auth entram em `ROTAS_PUBLICAS` no middleware; `/api/v1/conta` continua protegida.

### Telas

- `/registro`: nome, e-mail, senha (mínimo 8 caracteres), link para login e botão "Continuar com Google".
- `/verificar-email`: recebe `?token=`; confirma automaticamente ao carregar e mostra sucesso/erro com link para login; botão de reenviar.
- `/esqueci-senha`: campo de e-mail e resposta genérica.
- `/redefinir-senha?token=`: nova senha + confirmação.
- `/conta`: dados da conta, status de verificação, formulário de nome e formulário de senha; link em `/configuracoes`.
- `/login` e `/registro`: botão "Continuar com Google" com ícone SVG inline, separado do formulário por divisor.
- Todas com as classes existentes (`card`, `label`, `input`, `btn`, `link`, `min-h-11`), sem biblioteca nova de UI.

### Segurança

- PKCE S256 com `state` aleatório guardado em cookie HttpOnly; `SameSite=Lax` funciona porque o retorno do Google é um GET de topo.
- Tokens de e-mail armazenados só como hash, de uso único, com expiração.
- Respostas genéricas em esqueci/reenviar para não revelar existência de conta.
- `id_token` validado por assinatura (JWKS), `aud` igual ao Client ID, `iss` do Google, `exp` e `email_verified`. O modo demo preserva state e PKCE, mas curto-circuita essa validação com perfil sintético — nunca em produção.
- Vínculo da conta Google somente quando Google e a conta local attestam e-mail verificado; conta existente com senha nunca tem a senha sobrescrita e conta local não verificada nunca é vinculada ou marcada como verificada.
- Redefinição de senha invalida todas as sessões do usuário.
- Modo demo indisponível quando `NODE_ENV === 'production'`.
- Nenhum segredo no cliente, em log ou em mensagem de erro.

### Configuração

Variáveis lidas no servidor: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (padrão `http://localhost:3000/api/v1/auth/google/callback`), `EMAIL_WEBHOOK_URL` (opcional). Documento de setup com o passo de autorizar a redirect URI no Google Cloud Console. Nenhum valor é lido de `.env.local` durante a implementação.

### Testes

- RED→GREEN por serviço novo: tokens, vínculo Google, registro, redefinição, verificação, perfil.
- Rotas testadas com `criarBancoTeste()` + `setBancoAtivo()` (PGlite), sem rede.
- Validação do `id_token` com JWKS mockado; demo testado ponta a ponta no browser.
- Suíte final: `corepack pnpm test`, `corepack pnpm build`, auditoria 375/768/1280/1440 em claro/escuro nas telas novas, verificação de alvos ≥44 px e zero overflow.

## Decisões do builder check

Um revisor independente apontou quatro ambiguidades. Todas foram resolvidas aqui como decisões do builder, sem voltar ao usuário:

1. **Conta local existente e não verificada:** não é vinculada ao Google, mesmo com `email_verified` do Google. A recusa orienta a entrar com senha, verificar o e-mail e tentar de novo. Fecha a janela de takeover por cadastro prévio sem posse da caixa de entrada.
2. **Campo `retorno` do OAuth:** removido. O cookie guarda só `state` e `verifier`; o callback redireciona sempre para `/`. Elimina a classe de open redirect sem ganho funcional nesta entrega.
3. **Nome da empresa no cadastro Google:** `"Minha empresa"` como padrão, com nome da pessoa em `usuarios.nome`. Ambos editáveis em `/conta`; nenhuma tela extra de onboarding.
4. **Validação no modo demo:** state e PKCE são exercitados de verdade; a etapa de `id_token`/JWKS é substituída por perfil sintético fixo. O caminho real é coberto por testes com JWKS mockado. A identidade fixa permite testar colisões diretamente nas funções de domínio, sem tornar a demo configurável.

## O que fica para o builder

- Textos exatos dos estados de erro/sucesso e as chaves nos cinco idiomas, mantendo o padrão atual do dicionário.
- Ordem das tasks e o particionamento dos commits, desde que cada task termine verde.
- Detalhes visuais dos formulários, desde que usem o sistema de classes existente e respeitem o contraste.
- Escolha de `EMAIL_WEBHOOK_URL` vs. outro remetente: a interface fica pronta; provedor concreto não é desta entrega.
