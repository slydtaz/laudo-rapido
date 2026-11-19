import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PGlite } from '@electric-sql/pglite'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

/**
 * Supertype comum a PGlite e a postgres-js: expõe apenas a API pública do
 * Drizzle (insert/select/update/delete/transaction), jamais detalhes de um
 * driver específico. É o tipo de `db`, do banco ativo e do seam de injeção.
 */
export type Banco = PgDatabase<PgQueryResultHKT, typeof schema>
export type BancoProducao = PostgresJsDatabase<typeof schema>
export type BancoTeste = PgliteDatabase<typeof schema>

const diretorioMigracoes = () => fileURLToPath(new URL('../../../migrations/', import.meta.url))

let bancoAtivo: Banco | undefined

function bancoDeProducao(): BancoProducao {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL não configurada: defina a variável de ambiente para acessar o banco.')
  }
  // `prepare: false` mantém a compatibilidade com poolers (Neon/Supabase).
  return drizzlePostgres(postgres(url, { prepare: false }), { schema })
}

function bancoAtual(): Banco {
  return bancoAtivo ?? bancoDeProducao()
}

/**
 * Cliente Drizzle da aplicação. A conexão é criada na primeira consulta, para
 * que o build do Next não exija `DATABASE_URL` apenas para importar o módulo.
 */
export const db: Banco = new Proxy({} as Banco, {
  get(_alvo, propriedade) {
    const banco = bancoAtual()
    const valor = Reflect.get(banco, propriedade)
    return typeof valor === 'function' ? valor.bind(banco) : valor
  },
})

/**
 * Seam explícito de injeção de banco. `criarBancoTeste()` não tem efeitos
 * colaterais: quem quiser que os serviços (que importam `db`) usem o banco de
 * teste precisa declarar isso aqui.
 *
 * Uso previsto nas Tasks 4/5:
 *
 * ```ts
 * const banco = await criarBancoTeste()
 * setBancoAtivo(banco)
 * afterEach(() => setBancoAtivo(undefined)) // volta ao banco de produção
 * ```
 */
export function setBancoAtivo(banco: Banco | undefined): void {
  bancoAtivo = banco
}

/**
 * Executa `fn` com `banco` como banco ativo (via `db`) e restaura o banco
 * anterior ao final, inclusive se `fn` lançar.
 */
export async function withBanco<T>(
  banco: Banco,
  fn: (db: Banco) => Promise<T>,
): Promise<T> {
  const anterior = bancoAtivo
  bancoAtivo = banco
  try {
    return await fn(db)
  } finally {
    bancoAtivo = anterior
  }
}

async function aplicarMigracoes(pglite: PGlite): Promise<void> {
  const diretorio = diretorioMigracoes()
  const arquivos = (await readdir(diretorio))
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))

  for (const arquivo of arquivos) {
    const sql = await readFile(path.join(diretorio, arquivo), 'utf8')
    await pglite.exec(sql)
  }
}

/**
 * Cria um banco Postgres em memória (PGlite) com todas as migrações aplicadas
 * em ordem numérica. Não altera o banco ativo — use `setBancoAtivo()` ou
 * `withBanco()` quando um serviço precisar enxergar este banco.
 */
export async function criarBancoTeste(): Promise<BancoTeste> {
  const pglite = new PGlite()
  const banco = drizzlePglite(pglite, { schema })
  await aplicarMigracoes(pglite)
  return banco
}
