# ADR-002: Stack e arquitetura do MVP

**Status:** Aceito  
**Data:** 2026-11-18

## Contexto

O produto precisa rodar com custo mínimo, ser deployado por uma pessoa e permitir evolução futura sem reescrita. A parte mais delicada é a sincronização offline: o cliente pode ficar horas sem conexão e não pode perder fotos nem assinaturas.

## Decisão

**Monólito** Next.js (App Router) + TypeScript, com módulos por domínio (`auth`, `visitas`, `midia`, `relatorios`). Postgres para dados relacionais, storage S3-compatible para arquivos, PWA com IndexedDB para a fila offline.

| Camada | Escolha | Motivo |
|--------|---------|--------|
| UI/API | Next.js 15 + TypeScript | um deploy, SSR do link público |
| Estilo | Tailwind CSS | rapidez, sem design system próprio |
| ORM | Drizzle | tipado, migrações SQL explícitas |
| Validação | Zod | contrato único entre cliente e servidor |
| Testes | Vitest + PGlite | Postgres em memória, sem serviço externo |
| Banco | Neon (Postgres) | free tier, serverless |
| Storage | Cloudflare R2 (S3-compatible) | sem egress caro; abstração via SDK S3 |
| PDF | `@react-pdf/renderer` | determinístico, sem headless Chrome |
| Offline | Dexie (IndexedDB) | fila persistente, pouco código |
| Email | Resend | free tier suficiente |

## Alternativas consideradas

1. **Microsserviços** (sync, PDF, auth separados) — sobrecarga operacional sem escala que justifique. Rejeitada.
2. **MongoDB** — os dados são relacionais (visita → fotos → assinatura) e o relacionamento importa. Rejeitada.
3. **Puppeteer para PDF** — muito pesado e não determinístico. Rejeitada.
4. **Firebase** — lock-in e custo imprevisível. Rejeitada.

## Consequências

- **Positivas:** um repositório, um deploy, custo quase zero no início; fronteiras de módulo permitem extrair serviços depois.
- **Negativas:** a fila offline exige testes rigorosos de idempotência; PGlite é mais lento que Postgres real em testes de volume (aceitável no MVP).

## Regras derivadas

- Toda rota de API começa com `/api/v1`.
- Toda visita criada no cliente carrega `client_id` (UUID) — a chave de idempotência.
- O timestamp original da captura é preservado; sincronização nunca o sobrescreve.
- Nenhum secret é lido diretamente de código; variáveis em `.env.example`.
