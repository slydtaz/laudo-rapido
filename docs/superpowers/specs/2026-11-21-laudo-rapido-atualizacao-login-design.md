# Design — botão de atualização apenas no login

Data: 21/11/2026. Dono: Artur Fernandes Macêdo Vinhas.
Status: aguardando aprovação do dono.

## Objetivo

Manter o aviso/botão **Atualizar** apenas em `/login`, acompanhado de um card
de alerta visível para todos, com clique que realmente recarrega a página. O
bloqueio de acesso continua no servidor: só o e-mail permitido entra.

## Causa raiz

`RegistradorSW` está montado no layout raiz (`src/app/layout.tsx`), então o
botão aparece em qualquer página quando o service worker encontra nova versão.
`public/sw.js` chama `self.skipWaiting()` dentro de `install`, que ativa a nova
versão antes do clique. O `controllerchange` pode disparar antes do aceite;
`RegistradorSW` ignora esse evento pelo guard `aceitouAtualizacaoRef` e, se não
houver um novo `controllerchange` depois do clique, nunca recarrega. Daí o
botão parecer estático em algumas páginas.

## Decisões

1. **Escopo do botão.** Remover `<RegistradorSW />` do layout raiz e montá-lo
   somente em `src/app/(publico)/login/page.tsx`. Providers (`ProvedorPreferencias`
   e `ToastProvider`) continuam no layout raiz; nenhuma autorização no front-end.
2. **Ativação.** Remover `self.skipWaiting()` do `install` de `public/sw.js` e
   subir `VERSAO` para `laudo-rapido-v5` (a purga existente remove v4). O worker
   fica em `waiting` até o cliente enviar `SKIP_WAITING`. `clients.claim()` no
   `activate` permanece. Cache continua só de assets e `/offline`.
3. **Clique confiável.** Em `RegistradorSW`, além do `controllerchange`, tratar
   `worker.state === 'activated'` como gatilho de recarga única
   (`recarregadoRef`). Assim o clique funciona mesmo se o `controllerchange`
   tiver ocorrido antes. O guard que ignora eventos anteriores ao aceite fica.
4. **Card de alerta.** Inserir em `FormularioLogin`, acima do formulário, um
   `aside` com `role="status"` e classes `card`/alerta do projeto. Novas chaves
   i18n `loginAvisoManutencaoTitulo` e `loginAvisoManutencaoTexto` em `ptBR`,
   `en`, `es`, `fr`, `de`. Texto: área em preparação, acesso restrito ao
   responsável, outras contas bloqueadas automaticamente. PT-BR é a versão
   legal autoritativa.
5. **Gate inalterado.** `exigirAcesso`, `acessoOuErro`, `allowlist`, middleware
   e rotas API continuam iguais. O card é informativo; o bloqueio de quem não é
   o dono permanece server-side (401/403 e redirect para `/em-desenvolvimento`).
6. **Rótulos preservados.** `Entrar`, `Registrar nova visita`,
   `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`,
   `Baixar PDF` não mudam.

## Fora de escopo

Cobrança, checkout, Asaas, webhook de pagamento, JWT, rastreadores, cookie
banner, alteração da allowlist, tradução do corpo dos documentos legais.

## Verificação

- Teste novo/ajustado em `tests/service-worker.test.ts`: `install` não chama
  `skipWaiting`; `SKIP_WAITING` continua ativando.
- Teste novo/ajustado em `tests/atualizacao-pwa.test.tsx`: clique envia
  `SKIP_WAITING`; recarga ocorre uma vez tanto por `activated` quanto por
  `controllerchange`; evento anterior ao aceite não recarrega.
- Teste de `/login` com o card e o botão presentes; teste de que o botão não
  vem do layout raiz (páginas públicas sem o componente).
- `corepack pnpm vitest run --maxWorkers=4` e `corepack pnpm build`.
- Deploy somente com confirmação explícita; smoke em `/login`, `/privacidade`,
  `/termos`, `/cookies`, `/api/health`, `/planos` e APIs protegidas.
