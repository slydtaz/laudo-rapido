import { sql } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import {
  criarToken,
  consumirToken,
  gerarToken,
  hashToken,
  podeEmitirToken,
} from '../src/lib/auth/tokens'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, usuarios } from '../src/lib/db/schema'

afterEach(() => setBancoAtivo(undefined))

async function usuarioDeTeste(): Promise<string> {
  const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Token' }).returning()
  const [usuario] = await db
    .insert(usuarios)
    .values({ empresaId: empresa.id, email: `u-${crypto.randomUUID()}@exemplo.local` })
    .returning()
  return usuario.id
}

describe('tokens de uso único', () => {
  it('gera um token opaco e armazena apenas o hash', async () => {
    setBancoAtivo(await criarBancoTeste())
    const usuarioId = await usuarioDeTeste()

    expect(gerarToken()).toMatch(/^[A-Za-z0-9_-]{43}$/)

    const token = await criarToken(usuarioId, 'verificar_email')
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/)

    const resultado = await db.execute(sql`select id from tokens_auth`)
    const linhas = (resultado as { rows?: { id: string }[] }).rows ?? (resultado as { id: string }[])
    expect(linhas).toHaveLength(1)
    expect(linhas[0].id).toBe(hashToken(token))
    expect(linhas[0].id).not.toBe(token)
  })

  it('consome o token uma única vez e só no tipo correto', async () => {
    setBancoAtivo(await criarBancoTeste())
    const usuarioId = await usuarioDeTeste()
    const token = await criarToken(usuarioId, 'redefinir_senha')

    await expect(consumirToken(token, 'verificar_email')).resolves.toBeNull()
    await expect(consumirToken(token, 'redefinir_senha')).resolves.toBe(usuarioId)
    await expect(consumirToken(token, 'redefinir_senha')).resolves.toBeNull()
  })

  it('recusa token expirado', async () => {
    setBancoAtivo(await criarBancoTeste())
    const usuarioId = await usuarioDeTeste()
    const token = await criarToken(usuarioId, 'verificar_email')

    await db.execute(sql`update tokens_auth set expira_em = now() - interval '1 hour' where id = ${hashToken(token)}`)

    await expect(consumirToken(token, 'verificar_email')).resolves.toBeNull()
  })

  it('aplica cooldown de 60 segundos entre emissões', async () => {
    setBancoAtivo(await criarBancoTeste())
    const usuarioId = await usuarioDeTeste()
    const token = await criarToken(usuarioId, 'verificar_email')

    await expect(podeEmitirToken(usuarioId, 'verificar_email')).resolves.toBe(false)

    await db.execute(sql`update tokens_auth set criado_em = now() - interval '61 seconds' where id = ${hashToken(token)}`)

    await expect(podeEmitirToken(usuarioId, 'verificar_email')).resolves.toBe(true)
  })
})
