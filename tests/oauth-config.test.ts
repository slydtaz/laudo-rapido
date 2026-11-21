import { afterEach, describe, expect, it, vi } from 'vitest'

import { configuracaoGoogle, modoDemo } from '../src/lib/auth/google'

const URI_PRODUCAO = 'https://laudo-rapido.vercel.app/api/v1/auth/google/callback'
const URI_LOCAL = 'http://localhost:3000/api/v1/auth/google/callback'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('configuração OAuth por ambiente', () => {
  it('em produção, sem GOOGLE_REDIRECT_URI, falha fechado', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'cliente-teste.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'segredo-teste')
    vi.stubEnv('GOOGLE_REDIRECT_URI', undefined)

    expect(configuracaoGoogle()).toBeNull()
  })

  it('em produção, com GOOGLE_REDIRECT_URI vazia, falha fechado', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'cliente-teste.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'segredo-teste')
    vi.stubEnv('GOOGLE_REDIRECT_URI', '')

    expect(configuracaoGoogle()).toBeNull()
  })

  it('em produção, usa exatamente a URI de produção configurada', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'cliente-teste.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'segredo-teste')
    vi.stubEnv('GOOGLE_REDIRECT_URI', URI_PRODUCAO)

    expect(configuracaoGoogle()).toEqual({
      clientId: 'cliente-teste.apps.googleusercontent.com',
      clientSecret: 'segredo-teste',
      redirectUri: URI_PRODUCAO,
    })
  })

  it('em desenvolvimento, sem GOOGLE_REDIRECT_URI, mantém o fallback localhost', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'cliente-teste.apps.googleusercontent.com')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'segredo-teste')
    vi.stubEnv('GOOGLE_REDIRECT_URI', undefined)

    expect(configuracaoGoogle()?.redirectUri).toBe(URI_LOCAL)
  })

  it('em produção, sem variáveis, não há configuração nem modo demo', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GOOGLE_CLIENT_ID', undefined)
    vi.stubEnv('GOOGLE_CLIENT_SECRET', undefined)
    vi.stubEnv('GOOGLE_REDIRECT_URI', undefined)

    expect(configuracaoGoogle()).toBeNull()
    expect(modoDemo()).toBe(false)
  })
})
