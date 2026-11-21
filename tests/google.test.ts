import { generateKeyPairSync, sign } from 'node:crypto'

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { vincularOuCriarGoogle } from '../src/lib/auth/conta'
import {
  configuracaoGoogle,
  criarFluxoOAuth,
  modoDemo,
  perfilDemo,
  validarIdToken,
} from '../src/lib/auth/google'
import { hashSenha } from '../src/lib/auth/password'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, usuarios } from '../src/lib/db/schema'

const CONFIG = {
  clientId: 'cliente-teste.apps.googleusercontent.com',
  clientSecret: 'segredo-teste',
  redirectUri: 'http://localhost:3000/api/v1/auth/google/callback',
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'chave-teste', use: 'sig', alg: 'RS256' }
const { privateKey: outraChave } = generateKeyPairSync('rsa', { modulusLength: 2048 })

function jwt(
  payload: Record<string, unknown>,
  chave = privateKey,
  cabecalho: Record<string, unknown> = { alg: 'RS256', typ: 'JWT', kid: 'chave-teste' },
): string {
  const cab = Buffer.from(JSON.stringify(cabecalho)).toString('base64url')
  const dados = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const assinatura = sign('RSA-SHA256', Buffer.from(`${cab}.${dados}`), chave).toString('base64url')
  return `${cab}.${dados}.${assinatura}`
}

function payloadValido(): Record<string, unknown> {
  return {
    iss: 'https://accounts.google.com',
    aud: CONFIG.clientId,
    exp: Math.floor(Date.now() / 1000) + 600,
    sub: 'google-sub-valido',
    email: 'google@exemplo.local',
    email_verified: true,
    name: 'Técnico Google',
  }
}

function mockarJwks() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ keys: [jwk] })),
  )
}

const ambientes: Record<string, string | undefined> = {}

afterEach(() => {
  setBancoAtivo(undefined)
  vi.unstubAllGlobals()
  for (const [chave, valor] of Object.entries(ambientes)) {
    if (valor === undefined) delete process.env[chave]
    else process.env[chave] = valor
  }
})

describe('OAuth com Google', () => {
  it('lê a configuração do ambiente e o modo demo', () => {
    for (const chave of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI']) {
      ambientes[chave] = process.env[chave]
      delete process.env[chave]
    }
    const ambienteOriginal = process.env.NODE_ENV
    process.env.NODE_ENV = 'test'
    expect(configuracaoGoogle()).toBeNull()
    expect(modoDemo()).toBe(true)

    process.env.GOOGLE_CLIENT_ID = CONFIG.clientId
    process.env.GOOGLE_CLIENT_SECRET = CONFIG.clientSecret
    expect(configuracaoGoogle()).toEqual(CONFIG)
    process.env.NODE_ENV = 'production'
    expect(modoDemo()).toBe(false)
    process.env.NODE_ENV = ambienteOriginal
  })

  it('monta o fluxo PKCE real e o fluxo demo', () => {
    const demo = criarFluxoOAuth(null)
    expect(demo.url).toBe('/api/v1/auth/google/demo')
    expect(demo.state).toHaveLength(43)
    expect(demo.verifier).toHaveLength(43)

    const real = criarFluxoOAuth(CONFIG)
    const url = new URL(real.url)
    expect(url.origin).toBe('https://accounts.google.com')
    expect(url.searchParams.get('client_id')).toBe(CONFIG.clientId)
    expect(url.searchParams.get('redirect_uri')).toBe(CONFIG.redirectUri)
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('state')).toBe(real.state)
    expect(url.searchParams.get('code_challenge')).not.toBe(real.verifier)
  })

  it('valida assinatura e claims do id_token', async () => {
    mockarJwks()
    await expect(validarIdToken(jwt(payloadValido()), CONFIG)).resolves.toEqual({
      sub: 'google-sub-valido',
      email: 'google@exemplo.local',
      emailVerificado: true,
      nome: 'Técnico Google',
    })

    await expect(
      validarIdToken(jwt({ ...payloadValido(), aud: 'outro-cliente' }), CONFIG),
    ).resolves.toBeNull()
    await expect(
      validarIdToken(jwt({ ...payloadValido(), iss: 'https://evil.example' }), CONFIG),
    ).resolves.toBeNull()
    await expect(
      validarIdToken(jwt({ ...payloadValido(), exp: 1 }), CONFIG),
    ).resolves.toBeNull()
    await expect(
      validarIdToken(jwt({ ...payloadValido(), email_verified: false }), CONFIG),
    ).resolves.toBeNull()
    await expect(validarIdToken(jwt(payloadValido(), outraChave), CONFIG)).resolves.toBeNull()
    await expect(
      validarIdToken(jwt(payloadValido(), privateKey, { alg: 'HS256', kid: 'chave-teste' }), CONFIG),
    ).resolves.toBeNull()
    await expect(validarIdToken('token-malformado', CONFIG)).resolves.toBeNull()
  })

  it('usa uma identidade fixa no perfil demo', () => {
    expect(perfilDemo()).toEqual({
      sub: 'google-demo-sub',
      email: 'demo.google@exemplo.local',
      emailVerificado: true,
      nome: 'Técnico Demo',
    })
  })

  it('cria conta Google com empresa padrão e e-mail verificado', async () => {
    setBancoAtivo(await criarBancoTeste())

    const resultado = await vincularOuCriarGoogle(perfilDemo())

    expect(resultado).toMatchObject({ ok: true })
    if (!resultado.ok) return
    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, resultado.usuarioId))
    expect(usuario.senhaHash).toBeNull()
    expect(usuario.googleSub).toBe('google-demo-sub')
    expect(usuario.nome).toBe('Técnico Demo')
    expect(usuario.emailVerificadoEm).toBeInstanceOf(Date)
    const [empresa] = await db.select().from(empresas).where(eq(empresas.id, usuario.empresaId))
    expect(empresa.nome).toBe('Minha empresa')
  })

  it('vincula conta verificada sem sobrescrever a senha nem o nome', async () => {
    setBancoAtivo(await criarBancoTeste())
    const senhaHash = await hashSenha('senha-antiga-123')
    const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Local' }).returning()
    const [usuario] = await db
      .insert(usuarios)
      .values({
        empresaId: empresa.id,
        email: 'local@exemplo.local',
        nome: 'Nome Local',
        senhaHash,
      })
      .returning()
    await db
      .update(usuarios)
      .set({ emailVerificadoEm: new Date() })
      .where(eq(usuarios.id, usuario.id))

    const resultado = await vincularOuCriarGoogle({
      sub: 'sub-novo',
      email: '  LOCAL@exemplo.local ',
      emailVerificado: true,
      nome: 'Nome Google',
    })

    expect(resultado).toMatchObject({ ok: true, usuarioId: usuario.id })
    const [atualizado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(atualizado.senhaHash).toBe(senhaHash)
    expect(atualizado.nome).toBe('Nome Local')
    expect(atualizado.googleSub).toBe('sub-novo')
  })

  it('recusa conta local não verificada sem vincular nem marcar como verificada', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Local' }).returning()
    const [usuario] = await db
      .insert(usuarios)
      .values({
        empresaId: empresa.id,
        email: 'local@exemplo.local',
        senhaHash: await hashSenha('senha-antiga-123'),
      })
      .returning()

    const resultado = await vincularOuCriarGoogle({
      sub: 'sub-novo',
      email: 'local@exemplo.local',
      emailVerificado: true,
      nome: 'Nome Google',
    })

    expect(resultado).toMatchObject({ ok: false, codigo: 'CONTA_LOCAL_NAO_VERIFICADA' })
    const [inalterado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(inalterado.googleSub).toBeNull()
    expect(inalterado.emailVerificadoEm).toBeNull()
    await expect(
      vincularOuCriarGoogle({
        sub: 'sub-novo',
        email: 'local@exemplo.local',
        emailVerificado: false,
        nome: 'Nome Google',
      }),
    ).resolves.toMatchObject({ ok: false, codigo: 'EMAIL_NAO_VERIFICADO' })
  })

  it('recusa sub divergente', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Google' }).returning()
    const [usuario] = await db
      .insert(usuarios)
      .values({
        empresaId: empresa.id,
        email: 'google@exemplo.local',
        googleSub: 'sub-original',
        emailVerificadoEm: new Date(),
      })
      .returning()

    await expect(
      vincularOuCriarGoogle({
        sub: 'sub-diferente',
        email: 'google@exemplo.local',
        emailVerificado: true,
        nome: 'Nome',
      }),
    ).resolves.toMatchObject({ ok: false, codigo: 'SUB_DIVERGENTE' })
    const [inalterado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(inalterado.googleSub).toBe('sub-original')
  })
})
