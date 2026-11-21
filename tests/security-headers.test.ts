import { describe, expect, it } from 'vitest'

import nextConfig from '../next.config'

type RegraHeader = {
  source: string
  headers: { key: string; value: string }[]
}

type HeadersComContexto = (contexto: Record<string, never>) => Promise<RegraHeader[]>

describe('cabeçalhos de segurança', () => {
  it('aplica CSP e cabeçalhos de resposta em todas as rotas', async () => {
    const obterHeaders = nextConfig.headers as unknown as HeadersComContexto | undefined
    expect(obterHeaders).toBeTypeOf('function')

    const regras = await obterHeaders!({})
    expect(regras).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: '/(.*)' })]),
    )

    const todos = regras.flatMap((regra) => regra.headers)
    const valor = (key: string) =>
      todos.find((header) => header.key.toLowerCase() === key.toLowerCase())?.value

    const csp = valor('Content-Security-Policy') ?? ''
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("connect-src 'self'")

    expect(valor('X-Content-Type-Options')).toBe('nosniff')
    expect(valor('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    expect(valor('X-Frame-Options')).toBe('SAMEORIGIN')
  })
})
