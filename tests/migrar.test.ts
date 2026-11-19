import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import {
  aplicarMigracoes,
  listarArquivosMigracao,
  TABELA_CONTROLE_MIGRACOES,
} from '../src/lib/db/migrar'

function linhas(resultado: unknown): Array<Record<string, unknown>> {
  const possivel = resultado as { rows?: Array<Record<string, unknown>> }
  return Array.isArray(possivel?.rows) ? possivel.rows : (resultado as Array<Record<string, unknown>>)
}

describe('runner de migrações', () => {
  it('aplica migrações em ordem e é idempotente na segunda execução', async () => {
    const pglite = new PGlite()
    const banco = drizzle(pglite)

    const arquivos = await listarArquivosMigracao()
    expect(arquivos).toEqual(['0001_init.sql', '0002_sessoes.sql'])

    const executarSql = (comando: string) => pglite.exec(comando)
    await aplicarMigracoes(banco, executarSql)
    await aplicarMigracoes(banco, executarSql)

    const tabelas = linhas(
      await banco.execute(
        sql.raw("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"),
      ),
    ).map((linha) => linha.tablename)
    expect(tabelas).toEqual(
      expect.arrayContaining([
        'empresas',
        'usuarios',
        'visitas',
        'fotos',
        'assinaturas',
        'sessoes',
        TABELA_CONTROLE_MIGRACOES,
      ]),
    )

    const registradas = linhas(
      await banco.execute(
        sql.raw(`SELECT nome FROM "${TABELA_CONTROLE_MIGRACOES}" ORDER BY nome`),
      ),
    ).map((linha) => linha.nome)
    expect(registradas).toEqual(arquivos)
  })
})
