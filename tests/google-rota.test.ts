import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GET as iniciarGoogle } from '../src/app/api/v1/auth/google/route'
import { GET as callbackGoogle } from '../src/app/api/v1/auth/google/callback/route'
import { GET as demoGoogle } from '../src/app/api/v1/auth/google/demo/route'
import { definirCookieOAuth, COOKIE_OAUTH } from '../src/lib/auth/cookie'
import { hashSenha } from '../src/lib/auth/password'
import { COOKIE_SESSAO, lerSessao } from '../src/lib/auth/session'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, usuarios } from '../src/lib/db/schema'

const CHAVES = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'] as const
const ambienteOriginal: Record<string, string | undefined> = {}
const noOriginal = process.env.NODE_ENV

beforeEach(() => {
  for (const chave of CHAVES) {
    ambienteOriginal[chave] = process.env[chave]
    delete process.env[chave]
  }
  process.env.NODE_ENV = 'test'
})

afterEach(() => {
  setBancoAtivo(undefined)
  process.env.NODE_ENV = noOriginal
  for (const chave of CHAVES) {
    if (ambienteOriginal[chave] === undefined) delete process.env[chave]
    else process.env[chave] = ambienteOriginal[chave]
  }
})

function req(caminho: string, cookie: string | null = null): Request {
  return new Request(`http://localhost${caminho}`, {
    headers: cookie ? { cookie } : {},
  })
}

function cookieBruto(cookie: string): string {
  return cookie.split(';')[0]
}

function fluxo(state = 'estado-valido') {
  const cookie = definirCookieOAuth({ state, verifier: 'verificador' })
  return { cookie: cookieBruto(cookie), state }
}

async function contaLocalNaoVerificada() {
  const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Local' }).returning()
  const [usuario] = await db
    .insert(usuarios)
    .values({
      empresaId: empresa.id,
      email: 'demo.google@exemplo.local',
      senhaHash: await hashSenha('senha-antiga-123'),
    })
    .returning()
  return usuario
}

describe('rotas do OAuth com Google', () => {
  it('sem credenciais em dev redireciona para o consentimento demo', async () => {
    const resposta = await iniciarGoogle(req('/api/v1/auth/google'))

    expect(resposta.status).toBe(307)
    expect(resposta.headers.get('location')).toContain('/api/v1/auth/google/demo')
    const cookie = resposta.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${COOKIE_OAUTH}=`)
    expect(cookie).toContain('HttpOnly')
  })

  it('sem credenciais em produção responde 503', async () => {
    process.env.NODE_ENV = 'production'
    const resposta = await iniciarGoogle(req('/api/v1/auth/google'))
    expect(resposta.status).toBe(503)
  })

  it('com credenciais redireciona para o Google', async () => {
    process.env.GOOGLE_CLIENT_ID = 'cliente.apps.googleusercontent.com'
    process.env.GOOGLE_CLIENT_SECRET = 'segredo'
    const resposta = await iniciarGoogle(req('/api/v1/auth/google'))
    expect(resposta.status).toBe(307)
    expect(resposta.headers.get('location')).toContain('https://accounts.google.com')
  })

  it('a tela demo exige o cookie e avisa que não é o Google', async () => {
    expect((await demoGoogle(req('/api/v1/auth/google/demo'))).status).toBe(400)

    const { cookie, state } = fluxo()
    const resposta = await demoGoogle(req('/api/v1/auth/google/demo', cookie))
    expect(resposta.status).toBe(200)
    const html = await resposta.text()
    expect(html).toContain('Modo demo')
    expect(html).toContain(state)
    expect(html).toContain('demo-code')
  })

  it('a tela demo não existe em produção', async () => {
    process.env.NODE_ENV = 'production'
    const { cookie } = fluxo()
    expect((await demoGoogle(req('/api/v1/auth/google/demo', cookie))).status).toBe(404)
  })

  it('rejeita callback sem state ou com state divergente do cookie', async () => {
    setBancoAtivo(await criarBancoTeste())
    const { cookie } = fluxo('estado-esperado')

    expect(
      (await callbackGoogle(req('/api/v1/auth/google/callback?code=demo-code', cookie))).status,
    ).toBe(400)
    expect(
      (
        await callbackGoogle(
          req('/api/v1/auth/google/callback?code=demo-code&state=outro-estado', cookie),
        )
      ).status,
    ).toBe(400)
    expect(await db.select().from(usuarios)).toHaveLength(0)
  })

  it('o callback demo cria sessão e redireciona para /visitas', async () => {
    setBancoAtivo(await criarBancoTeste())
    const { cookie, state } = fluxo()

    const resposta = await callbackGoogle(
      req(`/api/v1/auth/google/callback?code=demo-code&state=${state}`, cookie),
    )

    expect(resposta.status).toBe(303)
    expect(resposta.headers.get('location')).toBe('http://localhost/visitas')
    const sessao = resposta.headers.get('set-cookie') ?? ''
    expect(sessao).toContain(`${COOKIE_SESSAO}=`)
    expect(sessao).toContain('HttpOnly')
    const usuario = resposta.headers.getSetCookie().find((valor) => valor.startsWith(`${COOKIE_SESSAO}=`))
    expect(usuario).toBeTruthy()
    const token = usuario!.split(';')[0].split('=')[1]
    await expect(lerSessao(req('/', `${COOKIE_SESSAO}=${token}`))).resolves.toMatchObject({
      usuarioId: expect.any(String),
    })
    const [registro] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.email, 'demo.google@exemplo.local'))
    expect(registro.googleSub).toBe('google-demo-sub')
  })

  it('conta local não verificada recebe erro sem sessão', async () => {
    setBancoAtivo(await criarBancoTeste())
    await contaLocalNaoVerificada()
    const { cookie, state } = fluxo()

    const resposta = await callbackGoogle(
      req(`/api/v1/auth/google/callback?code=demo-code&state=${state}`, cookie),
    )

    expect(resposta.status).toBe(303)
    expect(resposta.headers.get('location')).toContain('erro=CONTA_LOCAL_NAO_VERIFICADA')
    const cookies = resposta.headers.getSetCookie().join(' | ')
    expect(cookies).not.toContain(`${COOKIE_SESSAO}=`)
  })
})
