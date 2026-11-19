# LaudoRápido

Aplicativo para técnicos de campo registrarem uma visita (fotos antes/depois, observações e assinatura do cliente) e saírem com um PDF formal entregue na hora — funcionando mesmo sem internet.

**O que NÃO é:** um bloco de notas de lembretes. É documentação de entrega, com valor jurídico e operacional para o cliente.

## Pré-requisitos

- Node.js 22+ (use `corepack pnpm`; `pnpm` não é necessário estar no PATH)
- pnpm 9+ (o repositório fixa `pnpm@9.15.0` via `packageManager`)
- PostgreSQL gerenciado (Neon, Supabase etc.)
- Conta Cloudflare R2 (fotos e assinaturas)

Não há inferência de IA local: o projeto roda apenas com inferência em nuvem, se um dia precisar dela.

## Configuração

```bash
corepack pnpm install --frozen-lockfile
cp .env.example .env.local
```

Preencha `.env.local`:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | conexão Postgres (pooler suportado) |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | fotos e assinaturas no Cloudflare R2 |
| `SESSION_SECRET` | 32+ bytes; documentado para uso futuro (a auth atual usa tokens opacos no banco) |

> **Importante (R2):** o bucket precisa ter **acesso público habilitado** para URLs `r2.dev`. Fotos e assinatura precisam ser carregáveis por URL pública para aparecerem no PDF e no link de entrega.

Aplique o schema (runner próprio, idempotente, lê `migrations/*.sql` em ordem numérica e registra cada arquivo na tabela `migracoes_aplicadas`):

```bash
corepack pnpm db:migrate
```

Rode em desenvolvimento:

```bash
corepack pnpm dev
```

Abra `http://localhost:3000`. O health check está em `GET /api/health`.

## Fluxo de uso (offline-first)

1. Entre em `/login` com e-mail e senha de técnico (usuários são criados diretamente na tabela `usuarios`, com hash Argon2).
2. Abra `/visitas/nova` e registre a visita: cliente, tipo, fotos antes/depois e assinatura. As fotos são reduzidas no aparelho e tudo fica no IndexedDB (`fila.visitas`) mesmo sem sinal.
3. Ao voltar a conexão (botão "Sincronizar agora" ou evento `online` do navegador), `sincronizarFila()` envia **uma visita por requisição** a `POST /api/v1/visitas/sync`. A pendência só é removida após sucesso; falha de rede/5xx mantém o item. Um `413` mantém o item e avisa que o conteúdo passou do limite — remova fotos e salve uma nova visita.
4. O servidor grava a visita e faz upload da mídia normalizada para o R2. O link `/o/:token` é devolvido e guardado no IndexedDB (`fila.entregas`).
5. Compartilhe o link público `/o/:token`: o PDF é gerado **sob demanda, na entrega**, e oferece download. O token opaco é a única credencial do link.

## Instalação como PWA (RNF-01)

O app é instalável em celulares/tablets: o navegador oferece "Adicionar à tela inicial" quando o manifesto é servido. O service worker guarda apenas o app shell e os assets estáticos.

- **Funciona offline:** abrir o formulário, preencher, tirar fotos, assinar e salvar na fila do aparelho.
- **Exige rede:** sincronizar a fila, gerar/baixar o PDF e abrir o link público `/o/:token`.
- **Nunca é cacheado:** `/api/*`, `/o/*` e `/login` — dados de tenant e links opacos não ficam no cache do service worker.

Os ícones são gerados localmente (sem serviço externo) com:

```bash
corepack pnpm tsx scripts/gerar-icones.ts
```

## Rotas

- Páginas: `/` (landing), `/login`, `/visitas/nova` (captura offline-first), `/o/:token` (entrega pública)
- API: `/api/v1/auth/login`, `/api/v1/modelos`, `/api/v1/visitas`, `/api/v1/visitas/sync`, `/api/v1/visitas/:id/fotos`, `/api/v1/visitas/:id/assinar`, `/api/v1/visitas/:id/pdf`
- Health check: `/api/health`

Todas as rotas de API, exceto `/api/v1/auth/login` e `/api/health`, exigem cookie de sessão.

## Testes, CI e deploy

```bash
corepack pnpm test        # Vitest + PGlite (nenhum Postgres externo)
corepack pnpm test:watch
corepack pnpm build       # Next.js 15
```

- `.github/workflows/ci.yml`: Node 22, `pnpm install --frozen-lockfile`, testes e build em todo push/PR.
- `vercel.json`: framework `nextjs`, região `gru1`. Configure as variáveis de ambiente no projeto Vercel e rode `corepack pnpm db:migrate` contra o banco de produção antes de publicar.
- `db:generate` (drizzle-kit) escreve em `drizzle/` (gitignorado) apenas para inspeção; a fonte de verdade das migrações executáveis é `migrations/*.sql`.

## Estrutura

```
.
├── docs/                       # spec, ADRs e plano do MVP
├── migrations/                 # SQL versionado, aplicado pelo runner
├── scripts/migrar.ts           # entrypoint de `db:migrate`
├── scripts/gerar-icones.ts     # gera os PNGs PWA em public/ com sharp
├── public/                     # manifest, ícones e service worker
├── src/app/                    # App Router (páginas e rotas de API)
├── src/components/             # componentes de UI
├── src/lib/                    # auth, db, offline, pdf, storage, visita
└── tests/                      # Vitest + PGlite
```
