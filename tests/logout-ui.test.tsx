// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ConfiguracoesPage from '@/app/(app)/configuracoes/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}))

function comProvedores(conteudo: React.ReactNode) {
  return createElement(
    ProvedorPreferencias,
    null,
    createElement(ToastProvider, null, conteudo),
  )
}

describe('sair da conta em configurações', () => {
  beforeEach(() => {
    window.localStorage.clear()
    push.mockReset()
    refresh.mockReset()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('chama a API de logout e volta para o login', async () => {
    const buscar = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(ConfiguracoesPage)))

    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))

    await waitFor(() => {
      expect(buscar).toHaveBeenCalledWith('/api/v1/auth/logout', { method: 'POST' })
      expect(push).toHaveBeenCalledWith('/login')
      expect(refresh).toHaveBeenCalled()
    })
    expect(await screen.findByText('Sessão encerrada.')).toBeTruthy()
  })

  it('mantém a tela quando a API falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem rede')))

    render(comProvedores(createElement(ConfiguracoesPage)))
    fireEvent.click(screen.getByRole('button', { name: 'Sair da conta' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(push).not.toHaveBeenCalled()
  })
})
