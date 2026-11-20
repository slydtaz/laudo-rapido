import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { middleware } from '../src/middleware'

function req(caminho: string) {
  return new NextRequest(`http://localhost${caminho}`)
}

describe('middleware de rotas públicas', () => {
  it('permite logout sem sessão, então o logout é idempotente', () => {
    const resposta = middleware(req('/api/v1/auth/logout'))
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('x-middleware-next')).toBe('1')
  })

  it('permite as rotas públicas de auth sem sessão', () => {
    for (const caminho of [
      '/registro',
      '/verificar-email',
      '/esqueci-senha',
      '/redefinir-senha',
      '/api/v1/auth/registro',
      '/api/v1/auth/verificar',
      '/api/v1/auth/verificar/reenviar',
      '/api/v1/auth/senha/esqueci',
      '/api/v1/auth/senha/redefinir',
      '/api/v1/auth/google',
    ]) {
      expect(middleware(req(caminho)).status, caminho).toBe(200)
    }
  })

  it('continua bloqueando rotas protegidas sem sessão', () => {
    const api = middleware(req('/api/v1/visitas'))
    expect(api.status).toBe(401)
    expect(middleware(req('/api/v1/conta')).status).toBe(401)

    const pagina = middleware(req('/visitas'))
    expect(pagina.status).toBe(307)
    expect(pagina.headers.get('location')).toContain('/login')
    expect(middleware(req('/conta')).status).toBe(307)
  })
})
