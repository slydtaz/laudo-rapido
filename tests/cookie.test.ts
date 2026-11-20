import { afterEach, describe, expect, it } from 'vitest'

import {
  COOKIE_OAUTH,
  cookieOAuthExpirado,
  cookieSessaoExpirado,
  definirCookieOAuth,
  definirCookieSessao,
  lerCookieOAuth,
} from '../src/lib/auth/cookie'
import { COOKIE_SESSAO } from '../src/lib/auth/session'

const ambienteOriginal = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = ambienteOriginal
})

describe('cookies de autenticação', () => {
  it('monta o cookie de sessão com os atributos de segurança', () => {
    const cookie = definirCookieSessao('abc')
    expect(cookie).toContain(`${COOKIE_SESSAO}=abc`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('Max-Age=604800')
    expect(cookie).not.toContain('Secure')
  })

  it('adiciona Secure em produção', () => {
    process.env.NODE_ENV = 'production'
    expect(definirCookieSessao('abc')).toContain('Secure')
  })

  it('expira o cookie de sessão', () => {
    expect(cookieSessaoExpirado()).toContain('Max-Age=0')
    expect(cookieSessaoExpirado()).toContain('HttpOnly')
  })

  it('faz a ida e volta do cookie temporário de OAuth', () => {
    const cookie = definirCookieOAuth({ state: 'estado-123', verifier: 'verificador-456' })
    expect(cookie).toContain(`${COOKIE_OAUTH}=`)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Max-Age=600')

    const req = new Request('http://localhost/', {
      headers: { cookie: cookie.split(';')[0] },
    })
    expect(lerCookieOAuth(req)).toEqual({
      state: 'estado-123',
      verifier: 'verificador-456',
    })
  })

  it('devolve null para cookie de OAuth ausente ou corrompido', () => {
    expect(lerCookieOAuth(new Request('http://localhost/'))).toBeNull()
    const req = new Request('http://localhost/', {
      headers: { cookie: `${COOKIE_OAUTH}=!!!nao-e-json!!!` },
    })
    expect(lerCookieOAuth(req)).toBeNull()
  })

  it('expira o cookie de OAuth', () => {
    expect(cookieOAuthExpirado()).toContain('Max-Age=0')
  })
})
