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

  it('continua bloqueando rotas protegidas sem sessão', () => {
    const api = middleware(req('/api/v1/visitas'))
    expect(api.status).toBe(401)

    const pagina = middleware(req('/visitas'))
    expect(pagina.status).toBe(307)
    expect(pagina.headers.get('location')).toContain('/login')
  })
})
