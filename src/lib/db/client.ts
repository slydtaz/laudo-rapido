import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { PGlite } from '@electric-sql/pglite'
import { drizzle as drizzlePglite, type PgliteDatabase } from 'drizzle-orm/pglite'
import {
  drizzle as drizzlePostgres,
  type PostgresJsDatabase,
} from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

export type BancoProducao = PostgresJsDatabase<typeof schema>
export type BancoTeste = PgliteDatabase<typeof schema>

const diretorioMigracoes = () => fileURLToPath(new URL('../../../migrations/', import.meta.url))

let bancoAtivo: BancoProducao | undefined

function bancoDeProducao(): BancoProducao {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL não configurada: defina a variável de ambiente para acessar o banco.')
  }
  // `prepare: false` mantém a compatibilidade com poolers (Neon/Supabase).
  return drizzlePostgres(postgres(url, { prepare: false }), { schema })
}

function bancoAtual(): BancoProducao {
  bancoAtivo ??= bancoDeProducao()
  return bancoAtivo
}

/**
 * Cliente Drizzle da aplicação. A conexão é criada na primeira consulta, para
 * que o build do Next não exija `DATABASE_URL` apenas para importar o módulo.
 */
export const db: BancoProducao = new Proxy({} as BancoProducao, {
  get(_alvo, propriedade) {
    const banco = bancoAtual()
    const valor = Reflect.get(banco, propriedade)
    return typeof valor === 'function' ? valor.bind(banco) : valor
  },
})

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
 * em ordem numérica e o torna o banco ativo — assim os serviços da aplicação
 * usam o mesmo banco isolado do teste.
 */
export async function criarBancoTeste(): Promise<BancoTeste> {
  const pglite = new PGlite()
  const banco = drizzlePglite(pglite, { schema })
  await aplicarMigracoes(pglite)
  bancoAtivo = banco as unknown as BancoProducao
  return banco
}
