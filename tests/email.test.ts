import { afterEach, describe, expect, it, vi } from 'vitest'

import { enviarLink, montarLink } from '../src/lib/auth/email'

const ambienteOriginal = process.env.NODE_ENV
const webhookOriginal = process.env.EMAIL_WEBHOOK_URL

afterEach(() => {
  process.env.NODE_ENV = ambienteOriginal
  if (webhookOriginal === undefined) {
    delete process.env.EMAIL_WEBHOOK_URL
  } else {
    process.env.EMAIL_WEBHOOK_URL = webhookOriginal
  }
  vi.unstubAllGlobals()
})

describe('remetente de links de autenticação', () => {
  it('monta a URL de cada fluxo a partir do token', () => {
    expect(montarLink('verificar_email', 'abc')).toBe('/verificar-email?token=abc')
    expect(montarLink('redefinir_senha', 'xyz')).toBe('/redefinir-senha?token=xyz')
  })

  it('devolve o link em modo demo fora de produção', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.EMAIL_WEBHOOK_URL

    await expect(
      enviarLink({ tipo: 'verificar_email', token: 'tok-123', email: 'a@b.com' }),
    ).resolves.toEqual({
      modo: 'demo',
      link: '/verificar-email?token=tok-123',
      token: 'tok-123',
    })
  })

  it('envia só o link ao webhook, sem o token', async () => {
    process.env.NODE_ENV = 'test'
    process.env.EMAIL_WEBHOOK_URL = 'https://email.example/enviar'
    const buscar = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', buscar)

    const resultado = await enviarLink({
      tipo: 'redefinir_senha',
      token: 'segredo-456',
      email: 'usuario@exemplo.local',
    })

    expect(resultado).toEqual({ modo: 'webhook' })
    expect(buscar).toHaveBeenCalledTimes(1)
    const corpo = JSON.parse((buscar.mock.calls[0][1] as RequestInit).body as string)
    expect(corpo).toEqual({
      para: 'usuario@exemplo.local',
      assunto: 'Redefinição de senha',
      link: '/redefinir-senha?token=segredo-456',
    })
    expect(corpo).not.toHaveProperty('token')
  })

  it('falha silenciosamente em produção sem webhook', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.EMAIL_WEBHOOK_URL

    await expect(
      enviarLink({ tipo: 'verificar_email', token: 'tok-789', email: 'a@b.com' }),
    ).resolves.toEqual({ modo: 'silencioso' })
  })

  it('mantém a caixa demo visível depois que o módulo é recarregado', async () => {
    process.env.NODE_ENV = 'test'
    delete process.env.EMAIL_WEBHOOK_URL

    await enviarLink({
      tipo: 'redefinir_senha',
      token: 'tok-compartilhado-entre-bundles',
      email: 'caixa@exemplo.local',
    })

    // Cada route handler do Next.js em dev pode receber uma instância própria
    // deste módulo. A caixa precisa sobreviver ao recarregamento para que um
    // link emitido por uma rota apareça na rota que lista os links.
    vi.resetModules()
    const moduloRecarregado = await import('../src/lib/auth/email')
    expect(moduloRecarregado.listarLinksDemo().some((item) => item.token === 'tok-compartilhado-entre-bundles')).toBe(true)
  })
})
