# Login com Google — configuração

O LaudoRápido usa **Authorization Code + PKCE** próprio sobre as tabelas
`usuarios`/`sessoes`. Não há dependência do Supabase Auth e nenhuma cobrança.

## Variáveis de ambiente

Defina em `.env.local` (nunca commite este arquivo):

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | para login real | Client ID do projeto no Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | para login real | Client secret do mesmo projeto |
| `GOOGLE_REDIRECT_URI` | não | Padrão: `http://localhost:3000/api/v1/auth/google/callback` |
| `EMAIL_WEBHOOK_URL` | não | Webhook HTTP que recebe os links de verificação/recuperação |

Sem `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET`:

- **desenvolvimento/teste:** o botão leva a um consentimento **demo**,
  claramente sinalizado, com identidade fixa `demo.google@exemplo.local`;
- **produção:** `GET /api/v1/auth/google` responde `503` e a tela demo
  responde `404`. Nenhuma credencial é inventada ou aceita.

## Google Cloud Console

1. Crie/selecione um projeto e configure a tela de consentimento OAuth.
2. Crie uma credencial do tipo **ID do cliente OAuth**, aplicação **Web**.
3. Adicione `http://localhost:3000/api/v1/auth/google/callback` às
   **URI de redirecionamento autorizadas**. Em produção, adicione a URI
   pública equivalente e ajuste `GOOGLE_REDIRECT_URI`.
4. Copie o ID e o secret para `.env.local`. Não cole valores reais em código,
   testes, logs ou mensagens de erro.

## Fluxo

1. `/api/v1/auth/google` gera `state` + `verifier`, guarda ambos em cookie
   `HttpOnly`/`SameSite=Lax` de 10 minutos e redireciona para o Google
   (`code_challenge_method=S256`).
2. O Google volta para `/api/v1/auth/google/callback?code=...&state=...`.
   O `state` é comparado ao cookie; o código é trocado pelo `id_token`
   enviando o `verifier`.
3. A assinatura RS256 do `id_token` é validada contra o JWKS do Google, junto
   com `iss`, `aud`, `exp` e `email_verified`.
4. `vincularOuCriarGoogle` cria a conta (empresa padrão `Minha empresa`) ou
   vincula a conta existente **somente se** o e-mail local também estiver
   verificado. Conta local não verificada recebe erro e orientação para entrar
   com senha, verificar o e-mail e tentar de novo.
5. Uma sessão própria é criada no cookie `sessao`; o callback redireciona
   sempre para `/`. O parâmetro `retorno` não existe, evitando open redirect.

## Modo demo

O link serve para validar o fluxo sem credenciais reais:

```
/login → Continuar com Google → tela "Modo demo — não é o Google"
       → Continuar no modo demo → sessão criada → /
```

O consentimento demo preserva `state`/PKCE e curto-circuita apenas a troca de
código e a validação do `id_token`. Nenhuma credencial de produção é usada.

## E-mail

`EMAIL_WEBHOOK_URL`, quando definida, recebe um `POST` JSON com `para`,
`assunto` e `link` — o token viaja dentro do link, não em um campo separado.
Sem webhook e fora de produção, os links ficam na caixa em memória
`GET /api/v1/auth/demo-links` e aparecem em `/esqueci-senha`. Essa caixa é
compartilhada por quem usa o mesmo servidor de desenvolvimento e retorna `404`
em produção: não use endereços reais nela. Em produção sem webhook, o envio é
silencioso e a resposta das rotas continua genérica — sem revelar se a conta
existe.
