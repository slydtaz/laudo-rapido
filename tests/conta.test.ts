import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import {
  criarContaComSenha,
  redefinirSenha,
  reenviarVerificacao,
  solicitarRedefinicao,
  verificarEmail,
} from '../src/lib/auth/conta'
import { hashSenha, verificarSenha } from '../src/lib/auth/password'
import { criarToken } from '../src/lib/auth/tokens'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, sessoes, tokensAuth, usuarios } from '../src/lib/db/schema'

afterEach(() => setBancoAtivo(undefined))

async function usuarioComSenha(email = 'existente@exemplo.local') {
  const banco = await criarBancoTeste()
  setBancoAtivo(banco)
  const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Base' }).returning()
  const [usuario] = await db
    .insert(usuarios)
    .values({
      empresaId: empresa.id,
      email,
      senhaHash: await hashSenha('senha-antiga-123'),
    })
    .returning()
  return { banco, usuario }
}

describe('conta: registro, verificação e recuperação', () => {
  it('normaliza o e-mail e cria empresa e usuário com verificação pendente', async () => {
    setBancoAtivo(await criarBancoTeste())

    const resultado = await criarContaComSenha({
      nome: 'Ana',
      empresa: 'Climatizar',
      email: '  Ana@Exemplo.com ',
      senha: 'senha-forte-123',
    })

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, resultado.usuarioId))
    expect(usuario.email).toBe('ana@exemplo.com')
    expect(usuario.senhaHash).toBeTruthy()
    expect(usuario.emailVerificadoEm).toBeNull()
    expect(usuario.nome).toBe('Ana')
    const [empresa] = await db.select().from(empresas).where(eq(empresas.id, usuario.empresaId))
    expect(empresa.nome).toBe('Climatizar')
    expect(resultado.envio.modo).toBe('demo')
  })

  it('recusa senha curta e e-mail duplicado sem criar empresa', async () => {
    setBancoAtivo(await criarBancoTeste())
    const base = {
      nome: 'Ana',
      empresa: 'Climatizar',
      email: 'ana@exemplo.com',
      senha: 'senha-forte-123',
    }

    await expect(criarContaComSenha({ ...base, senha: 'curta' })).resolves.toEqual({
      ok: false,
      erro: 'A senha precisa ter pelo menos 8 caracteres.',
    })

    await expect(criarContaComSenha(base)).resolves.toMatchObject({ ok: true })
    await expect(criarContaComSenha({ ...base, email: 'ANA@exemplo.com' })).resolves.toEqual({
      ok: false,
      erro: 'E-mail já cadastrado.',
    })
    expect(await db.select().from(empresas)).toHaveLength(1)
  })

  it('verifica o e-mail uma única vez', async () => {
    const { usuario } = await usuarioComSenha()
    const token = await criarToken(usuario.id, 'verificar_email')

    await expect(verificarEmail(token)).resolves.toEqual({ ok: true })
    const [verificado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(verificado.emailVerificadoEm).toBeInstanceOf(Date)
    await expect(verificarEmail(token)).resolves.toEqual({
      ok: false,
      erro: 'Link inválido ou expirado.',
    })
  })

  it('redefine a senha, consome o token e encerra as sessões', async () => {
    const { usuario } = await usuarioComSenha()
    const token = await criarToken(usuario.id, 'redefinir_senha')
    await db.insert(sessoes).values({
      id: 'sessao-antiga',
      usuarioId: usuario.id,
      empresaId: usuario.empresaId,
      expiraEm: new Date(Date.now() + 60_000),
    })

    await expect(redefinirSenha(token, 'senha-nova-123')).resolves.toEqual({ ok: true })
    const [atualizado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(await verificarSenha('senha-nova-123', atualizado.senhaHash!)).toBe(true)
    expect(await verificarSenha('senha-antiga-123', atualizado.senhaHash!)).toBe(false)
    expect(await db.select().from(sessoes)).toHaveLength(0)
    await expect(redefinirSenha(token, 'outra-senha-123')).resolves.toEqual({
      ok: false,
      erro: 'Link inválido ou expirado.',
    })
  })

  it('não emite token para e-mail inexistente', async () => {
    setBancoAtivo(await criarBancoTeste())

    await expect(solicitarRedefinicao('ninguém@exemplo.local')).resolves.toBeNull()
    await expect(reenviarVerificacao('ninguém@exemplo.local')).resolves.toBeNull()
    expect(await db.select().from(tokensAuth)).toHaveLength(0)
  })
})
