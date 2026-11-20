# Relatório de expansão — LaudoRápido (2026-11-20)

## Escopo executado

| Task | Entrega | Commit |
| --- | --- | --- |
| 1 | Vitrine com 4 planos (Gratuito, Pro, Equipe, Enterprise) e preços acessíveis | `4717967` |
| 2 | Histórico de laudos em `/visitas` com busca e filtro por status | `df67f9d` |
| 3 | Resumo local na home (pendências e entregas do tenant) | `130373b` |
| 4 | Logout com exclusão da sessão e botão em configurações | `2e2b584` |
| 5 | Auditoria final (testes, build, browser, relatório) | este commit |

Base: `4eba046` (hotfix PWA). Nada foi pushado, mergeado ou deployado.

## Evidências

### Testes
- `corepack pnpm test` → **26 arquivos / 72 testes aprovados**.
- TDD aplicado com RED→GREEN nas unidades novas: `tests/planos.test.ts`, `tests/filtro.test.ts`, chave `homeResumo` em `tests/i18n.test.ts`, `tests/logout.test.ts`.
- Testes de componente adicionados para histórico, resumo da home e botão de sair.
- Testes antigos corrigidos para o novo contrato: `configuracoes-planos.test.tsx` (4 planos + mock de `useRouter`).

### Build
- `corepack pnpm build` → **compilado e 16/16 páginas estáticas geradas**, sem erros de lint ou tipo.
- Rotas confirmadas no output: `/`, `/login`, `/configuracoes`, `/planos`, `/visitas`, `/visitas/nova`, `/o/[token]`, `/api/health`, `/api/v1/sessao`, `/api/v1/modelos`, `/api/v1/visitas`, `/api/v1/visitas/[id]/pdf`, `/api/v1/visitas/[id]/fotos`, `/api/v1/visitas/[id]/assinar`, `/api/v1/visitas/sync`, **`/api/v1/auth/login` e `/api/v1/auth/logout`**.
- Build executado com dev server parado e `.next` limpo.

### Auditoria visual (Playwright, servidor de produção)
- **40 capturas**: 5 páginas (`/`, `/planos`, `/visitas`, `/configuracoes`, `/visitas/nova`) × 4 larguras (375, 768, 1280, 1440) × 2 temas (claro/escuro).
- **Zero overflow horizontal** e **zero alvos clicáveis abaixo de 44 px** em todas as combinações.
- Todas as páginas renderizaram no destino esperado, sem redirecionamentos indevidos com sessão ativa.
- Contraste verificado na home escura: fundo `rgb(9, 15, 19)` / texto `rgb(242, 247, 247)`.
- Capturas salvas em `artifacts/ui-audit/*-exp.png`.

### Verificação funcional no browser real
- `/planos`: 4 cards, nomes `Gratuito / Pro / Equipe / Enterprise`, 3 perguntas de FAQ, nenhum `<form>` de pagamento, aviso "Nenhuma cobrança" presente.
- `/visitas`: campo de busca, filtros `Todos / Sincronizados / Entregues / Rascunhos`, **3 laudos reais** carregados da API.
- `/configuracoes`: botão "Sair da conta" e dica sobre laudos salvos presentes.
- Home: bloco "Seu resumo" com pendências/entregas e atalho para o histórico.
- Logout ponta a ponta: clique → `POST /api/v1/auth/logout` → cookie `sessao` removido → redirecionamento para `/login` → aviso "Sessão encerrada.".

## Observações

- Os únicos erros de console durante a auditoria foram `401` de `/api/v1/sessao` na home pública sem cookie — comportamento esperado e absorvido pelo `try/catch` da página.
- Durante a sessão de dev anterior, os logs registraram `EMAXCONNSESSION` (limite de 15 clientes do Session Pooler do Supabase Free) após muitos hot reloads: cada bundle recompilado cria um pool `postgres()` que não é fechado. Não é regressão destas tasks e não foi alterado neste escopo. O servidor de produção (`next start`) operou sem esse erro.
- A vitrine de planos permanece estática: preços são texto de referência, sem enforcement de limites e sem cobrança real.
