import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { POST as registrar } from '../src/app/api/v1/auth/registro/route'
import { POST as reenviar } from '../src/app/api/v1/auth/verificar/reenviar/route'
import { POST as verificar } from '../src/app/api/v1/auth/verificar/route'
import { POST as esqueci } from '../src/app/api/v1/auth/senha/esqueci/route'
import { POST as redefinir } from '../src/app/api/v1/auth/senha/redefinir/route'
import { hashSenha, verificarSenha } from '../src/lib/auth/password'
import { criarSessao } from '../src/lib/auth/session'
import { criarToken } from '../src/lib/auth/tokens'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, usuarios } from '../src/lib/db/schema'

const EMAIL_PERMITIDO_ORIGINAL = process.env.EMAIL_PERMITIDO

beforeEach(() => {
  process.env.EMAIL_PERMITIDO = 'macedoartur1250@gmail.com'
})

afterEach(() => {
  setBancoAtivo(undefined)
  if (EMAIL_PERMITIDO_ORIGINAL === undefined) {
    delete process.env.EMAIL_PERMITIDO
  } else {
    process.env.EMAIL_PERMITIDO = EMAIL_PERMITIDO_ORIGINAL
  }
})

function post(corpo: unknown, token?: string): Request {
  return new Request('http://localhost/api/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { cookie: `sessao=${token}` } : {}),
    },
    body: JSON.stringify(corpo),
  })
}

/** Sessão já autorizada: /registro permanece bloqueado para o público. */
async function sessaoPermitida(): Promise<string> {
  const [empresa] = await db.insert(empresas).values({ nome: 'Empresa da allowlist' }).returning()
  const [usuario] = await db
    .insert(usuarios)
    .values({ empresaId: empresa.id, email: 'macedoartur1250@gmail.com' })
    .returning()
  return criarSessao(usuario.id, empresa.id)
}

function todaResposta(resposta: Response) {
  return { status: resposta.status, cookie: resposta.headers.get('set-cookie'), corpo: resposta.json() }
}

async function usuarioExistente(): Promise<{ id: string; email: string }> {
  const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Rotas' }).returning()
  const email = `rota-${crypto.randomUUID()}@exemplo.local`
  const [usuario] = await db
    .insert(usuarios)
    .values({
      empresaId: empresa.id,
      email,
      senhaHash: await hashSenha('senha-antiga-123'),
    })
    .returning()
  return { id: usuario.id, email }
}

describe('rotas de registro, verificação e recuperação', () => {
  it('registra sem criar sessão e devolve o link no modo demo', async () => {
    setBancoAtivo(await criarBancoTeste())

    const token = await sessaoPermitida()
    const resposta = await registrar(
      post({ nome: 'Ana', empresa: 'Climatizar', email: 'ana@exemplo.com', senha: 'senha-forte-123' }, token),
    )
    const { status, cookie, corpo } = todaResposta(resposta)

    expect(status).toBe(201)
    expect(cookie).toBeNull()
    const json = await corpo
    expect(json).toMatchObject({ ok: true, token: expect.any(String) })
    expect(json.link).toBe(`/verificar-email?token=${json.token}`)
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, 'ana@exemplo.com'))
    expect(usuario.emailVerificadoEm).toBeNull()
  })

  it('devolve 400 para corpo inválido e para e-mail duplicado', async () => {
    setBancoAtivo(await criarBancoTeste())
    const corpo = { nome: 'Ana', empresa: 'Climatizar', email: 'ana@exemplo.com', senha: 'senha-forte-123' }
    const token = await sessaoPermitida()
    await registrar(post(corpo, token))

    await expect(registrar(post({ ...corpo, email: 'invalido' }, token)).then((r) => r.status)).resolves.toBe(400)
    await expect(registrar(post({ ...corpo, senha: 'curta' }, token)).then((r) => r.status)).resolves.toBe(400)
    await expect(registrar(post({ ...corpo, email: 'ANA@exemplo.com' }, token)).then((r) => r.status)).resolves.toBe(400)
    expect(await db.select().from(empresas)).toHaveLength(2)
  })

  it('verifica o e-mail e recusa token inválido', async () => {
    setBancoAtivo(await criarBancoTeste())
    const { id } = await usuarioExistente()
    const token = await criarToken(id, 'verificar_email')

    await expect(verificar(post({ token })).then((r) => r.status)).resolves.toBe(200)
    await expect(verificar(post({ token })).then((r) => r.status)).resolves.toBe(400)
    await expect(verificar(post({ token: 'errado' })).then((r) => r.status)).resolves.toBe(400)
  })

  it('responde 202 idêntico no reenvio, independente do e-mail', async () => {
    setBancoAtivo(await criarBancoTeste())
    const { email } = await usuarioExistente()

    const existente = await reenviar(post({ email }))
    const inexistente = await reenviar(post({ email: 'ninguém@exemplo.local' }))

    expect(existente.status).toBe(202)
    expect(await existente.json()).toEqual({ ok: true })
    expect(inexistente.status).toBe(202)
    expect(await inexistente.json()).toEqual({ ok: true })
  })

  it('responde 202 idêntico no esqueci-senha, sem enumeração', async () => {
    setBancoAtivo(await criarBancoTeste())
    const { email } = await usuarioExistente()

    const existente = await esqueci(post({ email }))
    const inexistente = await esqueci(post({ email: 'ninguém@exemplo.local' }))

    expect(existente.status).toBe(202)
    expect(await existente.json()).toEqual({ ok: true })
    expect(inexistente.status).toBe(202)
    expect(await inexistente.json()).toEqual({ ok: true })
  })

  it('redefine a senha pela rota e recusa token reutilizado', async () => {
    setBancoAtivo(await criarBancoTeste())
    const { id } = await usuarioExistente()
    const token = await criarToken(id, 'redefinir_senha')

    await expect(redefinir(post({ token, senha: 'senha-nova-123' })).then((r) => r.status)).resolves.toBe(200)
    const [atualizado] = await db.select().from(usuarios).where(eq(usuarios.id, id))
    expect(await verificarSenha('senha-nova-123', atualizado.senhaHash!)).toBe(true)
    await expect(
      redefinir(post({ token, senha: 'outra-senha-123' })).then((r) => r.status),
    ).resolves.toBe(400)
  })
})
