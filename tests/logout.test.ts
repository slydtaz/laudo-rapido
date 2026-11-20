import { afterEach, describe, expect, it } from 'vitest'

import {
  COOKIE_SESSAO,
  criarSessao,
  encerrarSessao,
  extrairTokenCookie,
  lerSessao,
} from '../src/lib/auth/session'
import { criarBancoTeste, setBancoAtivo } from '../src/lib/db/client'
import { POST } from '../src/app/api/v1/auth/logout/route'

afterEach(() => setBancoAtivo(undefined))

function reqComToken(token: string | null): Request {
  return new Request('http://localhost/', {
    headers: token ? { cookie: `${COOKIE_SESSAO}=${token}` } : {},
  })
}

describe('logout', () => {
  it('extrai o token do cookie de sessão', async () => {
    setBancoAtivo(await criarBancoTeste())
    const token = await criarSessao('u-1', 'e-1')
    expect(extrairTokenCookie(reqComToken(token))).toBe(token)
    expect(extrairTokenCookie(reqComToken(null))).toBeNull()
  })

  it('remove a sessão do banco e invalida a leitura', async () => {
    setBancoAtivo(await criarBancoTeste())
    const token = await criarSessao('u-1', 'e-1')
    await expect(lerSessao(reqComToken(token))).resolves.toEqual({
      usuarioId: 'u-1',
      empresaId: 'e-1',
    })

    await encerrarSessao(reqComToken(token))

    await expect(lerSessao(reqComToken(token))).resolves.toBeNull()
  })

  it('é idempotente sem cookie e com token desconhecido', async () => {
    setBancoAtivo(await criarBancoTeste())
    await expect(encerrarSessao(reqComToken(null))).resolves.toBeUndefined()
    await expect(encerrarSessao(reqComToken('token-desconhecido'))).resolves.toBeUndefined()
  })

  it('a rota encerra a sessão e expira o cookie', async () => {
    setBancoAtivo(await criarBancoTeste())
    const token = await criarSessao('u-1', 'e-1')

    const resposta = await POST(reqComToken(token))

    expect(resposta.status).toBe(200)
    await expect(resposta.json()).resolves.toEqual({ ok: true })
    const cookie = resposta.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${COOKIE_SESSAO}=`)
    expect(cookie).toContain('Max-Age=0')
    expect(cookie).toContain('HttpOnly')
    await expect(lerSessao(reqComToken(token))).resolves.toBeNull()
  })
})
