# Checklist de deploy na Vercel — LaudoRápido

Domínio de produção: `https://laudo-rapido.vercel.app`.
Callback Google (exato): `https://laudo-rapido.vercel.app/api/v1/auth/google/callback`.

Este arquivo é um checklist para execução futura. Nenhum passo abaixo foi executado nesta task:
não houve criação de projeto, `vercel link`, configuração de variáveis, migração em produção nem deploy.
O dono configura os valores no painel da Vercel; nenhum segredo é registrado neste arquivo.
`vercel.json` já fixa `framework: nextjs` e `regions: ["gru1"]`.

## Variáveis de ambiente (nomes exatos)

| Nome | Observação |
| --- | --- |
| `DATABASE_URL` | valor fornecido pelo dono |
| `SESSION_SECRET` | valor fornecido pelo dono |
| `GOOGLE_CLIENT_ID` | valor fornecido pelo dono |
| `GOOGLE_CLIENT_SECRET` | valor fornecido pelo dono |
| `GOOGLE_REDIRECT_URI` | `https://laudo-rapido.vercel.app/api/v1/auth/google/callback` |
| `EMAIL_WEBHOOK_URL` | valor fornecido pelo dono |
| `EMAIL_PERMITIDO` | `macedoartur1250@gmail.com` |
| `R2_ACCOUNT_ID` | valor fornecido pelo dono |
| `R2_ACCESS_KEY_ID` | valor fornecido pelo dono |
| `R2_SECRET_ACCESS_KEY` | valor fornecido pelo dono |
| `R2_BUCKET` | valor fornecido pelo dono |
| `R2_ENDPOINT` | valor fornecido pelo dono |
| `R2_PUBLIC_BASE` | valor fornecido pelo dono |
| `R2_REGION` | valor fornecido pelo dono |
| `R2_FORCE_PATH_STYLE` | valor fornecido pelo dono |

A URI de redirecionamento acima também precisa ser cadastrada no Google Cloud Console pelo dono (não feito aqui).
Produção não usa `localhost`: a aplicação falha fechado sem `GOOGLE_REDIRECT_URI`.

## Passos (somente após confirmação explícita do dono)

1. No terminal do dono, na pasta da worktree: `vercel login`.
2. Ligar a pasta ao projeto: `vercel link`.
3. Aplicar a migração localmente, antes do deploy, com o banco já configurado:

   ```sh
   corepack pnpm tsx -e "process.loadEnvFile('.env.local'); void import('./scripts/migrar.ts')"
   ```

4. Publicar: `vercel --prod`.
5. Verificar com `curl` (substituir apenas se o dono usar outro domínio):

   ```sh
   curl.exe -o NUL -w '%{http_code}\n' https://laudo-rapido.vercel.app/privacidade
   curl.exe -o NUL -w '%{http_code}\n' https://laudo-rapido.vercel.app/termos
   curl.exe -o NUL -w '%{http_code}\n' https://laudo-rapido.vercel.app/cookies
   curl.exe -o NUL -w '%{http_code}\n' https://laudo-rapido.vercel.app/api/health
   curl.exe -o NUL -w '%{http_code}\n' https://laudo-rapido.vercel.app/planos
   curl.exe -s https://laudo-rapido.vercel.app/login
   ```

   Esperado: `200` para `/privacidade`, `/termos`, `/cookies` e `/api/health`;
   `307` para `/planos` sem cookie; o HTML de `/login` deve conter `/privacidade`, `/termos`,
   `/cookies` e o rótulo `Entrar`. O bloqueio de outro e-mail já é verificado por
   `tests/acesso-apis.test.ts` e `tests/google-rota.test.ts`, sem login real.

6. Se algo falhar: `vercel rollback`.

Nenhuma cobrança, checkout ou webhook de pagamento está implementado nesta versão.
