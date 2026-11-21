import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { config, middleware, ROTAS_PUBLICAS } from '../src/middleware'

function req(caminho: string) {
  return new NextRequest(`http://localhost${caminho}`)
}

/** Rotas que precisam responder sem cookie, inclusive para e-mail não liberado. */
const LIBERADAS = [
  '/login',
  '/em-desenvolvimento',
  '/offline',
  '/esqueci-senha',
  '/redefinir-senha',
  '/verificar-email',
  '/api/health',
  '/api/v1/auth/login',
  '/api/v1/auth/verificar',
  '/api/v1/auth/verificar/reenviar',
  '/api/v1/auth/senha/esqueci',
  '/api/v1/auth/senha/redefinir',
  '/api/v1/auth/google',
  '/api/v1/auth/google/callback',
  '/api/v1/auth/logout',
  '/privacidade',
  '/termos',
  '/cookies',
]

function bateNoMatcher(caminho: string) {
  return config.matcher.some((padrao) => new RegExp(`^${padrao}$`).test(caminho))
}

describe('middleware do gate de produção', () => {
  it('expõe exatamente as rotas públicas permitidas', () => {
    expect(ROTAS_PUBLICAS).toEqual(LIBERADAS)
  })

  it('mantém login, Google, recuperação, health e telas de bloqueio acessíveis sem sessão', () => {
    for (const caminho of LIBERADAS) {
      const resposta = middleware(req(caminho))
      expect(resposta.status, caminho).toBe(200)
      expect(resposta.headers.get('x-middleware-next'), caminho).toBe('1')
    }
  })

  it('redireciona páginas protegidas sem cookie para /em-desenvolvimento', () => {
    for (const caminho of [
      '/',
      '/planos',
      '/registro',
      '/o/x',
      '/visitas',
      '/visitas/nova',
      '/configuracoes',
      '/conta',
    ]) {
      const resposta = middleware(req(caminho))
      expect(resposta.status, caminho).toBe(307)
      expect(resposta.headers.get('location'), caminho).toContain('/em-desenvolvimento')
    }
  })

  it('devolve 403 JSON para API protegida sem cookie', async () => {
    for (const caminho of ['/api/v1/visitas', '/api/v1/conta', '/api/v1/sessao']) {
      const resposta = middleware(req(caminho))
      expect(resposta.status, caminho).toBe(403)
      expect(await resposta.json(), caminho).toEqual({
        erro: 'Aplicativo em desenvolvimento.',
      })
    }
  })

  it('deixa passar com cookie: a validação real fica no servidor', () => {
    const comCookie = new NextRequest('http://localhost/visitas', {
      headers: { cookie: 'sessao=opaco' },
    })
    expect(middleware(comCookie).status).toBe(200)
  })

  it('não intercepta assets do Next nem arquivos com extensão', () => {
    for (const caminho of [
      '/_next/static/chunks/app.js',
      '/_next/static/chunks',
      '/__next/static/chunks',
      '/logo.png',
      '/favicon.ico',
    ]) {
      expect(bateNoMatcher(caminho), caminho).toBe(false)
    }
    expect(bateNoMatcher('/visitas')).toBe(true)
  })
})
