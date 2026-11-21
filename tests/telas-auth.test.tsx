// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET as listaDemoLinks } from '@/app/api/v1/auth/demo-links/route'
import PaginaEsqueciSenha from '@/app/(publico)/esqueci-senha/page'
import PaginaRedefinirSenha from '@/app/(publico)/redefinir-senha/page'
import FormularioRegistro from '@/app/registro/FormularioRegistro'
import PaginaVerificarEmail from '@/app/(publico)/verificar-email/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'
import { enviarLink, listarLinksDemo } from '@/lib/auth/email'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

function comProvedores(conteudo: React.ReactNode) {
  return createElement(
    ProvedorPreferencias,
    null,
    createElement(ToastProvider, null, conteudo),
  )
}

const ambienteOriginal = process.env.NODE_ENV

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  process.env.NODE_ENV = ambienteOriginal
  window.history.pushState({}, '', '/')
})

describe('telas de registro e recuperação', () => {
  it('/registro mostra os campos e envia o cadastro normalizado', async () => {
    const buscar = vi.fn().mockResolvedValue(
      Response.json({ ok: true, link: '/verificar-email?token=tok-1', token: 'tok-1' }, { status: 201 }),
    )
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(FormularioRegistro)))

    expect(screen.getByRole('link', { name: 'Entrar' }).getAttribute('href')).toBe('/login')
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'Climatizar' } })
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'Ana@Exemplo.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senha-forte-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    await waitFor(() => expect(buscar).toHaveBeenCalled())
    expect(buscar.mock.calls[0][0]).toBe('/api/v1/auth/registro')
    const corpo = JSON.parse((buscar.mock.calls[0][1] as RequestInit).body as string)
    expect(corpo).toMatchObject({ nome: 'Ana', empresa: 'Climatizar', senha: 'senha-forte-123' })
    expect(await screen.findByText(/Verifique seu e-mail/)).toBeTruthy()
    expect(screen.getByRole('link', { name: /abrir link de verificação/i }).getAttribute('href')).toBe(
      '/verificar-email?token=tok-1',
    )
  })

  it('/esqueci-senha mostra a resposta genérica', async () => {
    const buscar = vi.fn().mockResolvedValue(Response.json({ ok: true }, { status: 202 }))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(PaginaEsqueciSenha)))

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'ana@exemplo.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar link de redefinição' }))

    await waitFor(() => expect(buscar).toHaveBeenCalled())
    expect(buscar.mock.calls[0][0]).toBe('/api/v1/auth/senha/esqueci')
    expect(await screen.findByText(/Se o e-mail existir/)).toBeTruthy()
  })

  it('/verificar-email consome o token da query string ao montar', async () => {
    window.history.pushState({}, '', '/verificar-email?token=tok-verificar')
    const buscar = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(PaginaVerificarEmail)))

    await waitFor(() => expect(buscar).toHaveBeenCalled())
    expect(buscar.mock.calls[0][0]).toBe('/api/v1/auth/verificar')
    const corpo = JSON.parse((buscar.mock.calls[0][1] as RequestInit).body as string)
    expect(corpo).toEqual({ token: 'tok-verificar' })
    expect(await screen.findByText(/E-mail verificado/)).toBeTruthy()
  })

  it('/verificar-email consome o token uma única vez no StrictMode', async () => {
    window.history.pushState({}, '', '/verificar-email?token=tok-unico')
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ ok: true }))
      .mockResolvedValueOnce(Response.json({ erro: 'Link inválido' }, { status: 400 }))
    vi.stubGlobal('fetch', buscar)

    render(createElement(StrictMode, null, comProvedores(createElement(PaginaVerificarEmail))))

    await waitFor(() => expect(screen.getByText(/E-mail verificado/)).toBeTruthy())
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('/redefinir-senha envia o token da URL e a nova senha', async () => {
    window.history.pushState({}, '', '/redefinir-senha?token=tok-reset')
    const buscar = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(PaginaRedefinirSenha)))

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha-nova-123' } })
    fireEvent.change(screen.getByLabelText('Confirmar nova senha'), { target: { value: 'senha-nova-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar nova senha' }))

    await waitFor(() => expect(buscar).toHaveBeenCalled())
    expect(buscar.mock.calls[0][0]).toBe('/api/v1/auth/senha/redefinir')
    const corpo = JSON.parse((buscar.mock.calls[0][1] as RequestInit).body as string)
    expect(corpo).toEqual({ token: 'tok-reset', senha: 'senha-nova-123' })
  })

  it('a caixa demo guarda links emitidos e a rota some em produção', async () => {
    process.env.NODE_ENV = 'test'
    const email = `caixa-${Date.now()}@exemplo.local`
    await enviarLink({ tipo: 'redefinir_senha', token: 'tok-caixa', email })
    expect(listarLinksDemo().some((link) => link.email === email && link.token === 'tok-caixa')).toBe(true)

    const resposta = await listaDemoLinks()
    expect(resposta.status).toBe(200)
    const corpo = (await resposta.json()) as { links: Array<{ email: string; link: string }> }
    expect(corpo.links.some((link) => link.email === email)).toBe(true)

    process.env.NODE_ENV = 'production'
    expect((await listaDemoLinks()).status).toBe(404)
  })
})
