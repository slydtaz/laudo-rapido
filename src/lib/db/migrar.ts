import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from 'drizzle-orm'

import type { Banco } from './client'

export const DIRETORIO_MIGRACOES = path.join(process.cwd(), 'migrations')
export const TABELA_CONTROLE_MIGRACOES = 'migracoes_aplicadas'

/** Executa SQL cru. PGlite usa `exec()` para multi-statements; postgres-js usa `execute()`. */
type ExecutorSql = (comando: string) => Promise<unknown>

export async function listarArquivosMigracao(): Promise<string[]> {
  const arquivos = await readdir(DIRETORIO_MIGRACOES)
  return arquivos
    .filter((arquivo) => arquivo.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

async function migracaoAplicada(banco: Banco, nome: string): Promise<boolean> {
  const resultado = await banco.execute(sql`
    SELECT 1 AS ok
    FROM ${sql.identifier(TABELA_CONTROLE_MIGRACOES)}
    WHERE ${sql.identifier('nome')} = ${nome}
    LIMIT 1
  `)
  const linhas = (resultado as { rows?: unknown[] }).rows ?? (resultado as unknown[])
  return Array.isArray(linhas) && linhas.length > 0
}

async function registrarMigracao(banco: Banco, nome: string): Promise<void> {
  await banco.execute(sql`
    INSERT INTO ${sql.identifier(TABELA_CONTROLE_MIGRACOES)} (${sql.identifier('nome')})
    VALUES (${nome})
  `)
}

/**
 * Aplica as migrações SQL escritas à mão em `migrations/*.sql`, em ordem
 * numérica, usando a tabela de controle `migracoes_aplicadas` para idempotência.
 * Não modifica os arquivos de migração existentes.
 *
 * `executarSql` é o seam para drivers que não aceitam múltiplos comandos por
 * prepared statement (PGlite): o chamador passa `pglite.exec`. O padrão usa o
 * `db` de produção (postgres-js), que aceita o arquivo inteiro via `execute`.
 */
export async function aplicarMigracoes(
  banco: Banco,
  executarSql: ExecutorSql = (comando) => banco.execute(sql.raw(comando)),
): Promise<void> {
  await executarSql(
    `CREATE TABLE IF NOT EXISTS "${TABELA_CONTROLE_MIGRACOES}" ("nome" text PRIMARY KEY NOT NULL, "aplicado_em" timestamp NOT NULL DEFAULT now())`,
  )
  const arquivos = await listarArquivosMigracao()

  for (const arquivo of arquivos) {
    if (await migracaoAplicada(banco, arquivo)) {
      continue
    }
    const conteudo = await readFile(
      path.join(DIRETORIO_MIGRACOES, arquivo),
      'utf8',
    )
    await executarSql(conteudo)
    await registrarMigracao(banco, arquivo)
  }
}
