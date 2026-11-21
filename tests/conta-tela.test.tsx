// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ConfiguracoesPage from '@/app/configuracoes/page'
import PaginaConta from '@/app/conta/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'

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

const PERFIL = {
  nome: 'Ana',
  email: 'perfil@exemplo.local',
  empresa: 'Climatizar',
  verificado: true,
  provedor: 'senha',
  criadoEm: '2026-11-20T10:00:00.000Z',
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('tela de conta', () => {
  it('mostra perfil, status e os dois formulários', async () => {
    const buscar = vi.fn().mockResolvedValue(Response.json(PERFIL))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(PaginaConta)))

    expect(await screen.findByText('perfil@exemplo.local')).toBeTruthy()
    expect(screen.getByText('Climatizar')).toBeTruthy()
    expect(screen.getByText(/E-mail verificado/)).toBeTruthy()
    expect(screen.getByLabelText('Nome')).toBeTruthy()
    expect(screen.getByLabelText('Empresa')).toBeTruthy()
    expect(screen.getByLabelText('Senha atual')).toBeTruthy()
    expect(screen.getByLabelText('Nova senha')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Alterar senha' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Maria' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))
    await waitFor(() =>
      expect(buscar.mock.calls.some((chamada) => chamada[1]?.method === 'PATCH')).toBe(true),
    )
  })

  it('atualiza o cartão de perfil logo após salvar nome e empresa', async () => {
    const buscar = vi.fn().mockImplementation((_url: string, opcoes?: RequestInit) =>
      Promise.resolve(Response.json(opcoes?.method === 'PATCH' ? { ok: true } : PERFIL)),
    )
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(PaginaConta)))
    expect(await screen.findByText('Ana')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Ana Maria' } })
    fireEvent.change(screen.getByLabelText('Empresa'), { target: { value: 'Climatizar Sul' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findByText('Ana Maria')).toBeTruthy()
    expect(await screen.findByText('Climatizar Sul')).toBeTruthy()
  })

  it('mostra a senha atual depois que uma conta Google cria senha', async () => {
    const perfilGoogle = { ...PERFIL, provedor: 'google' as const }
    const buscar = vi.fn().mockImplementation((_url: string, opcoes?: RequestInit) =>
      Promise.resolve(Response.json(opcoes?.method === 'POST' ? { ok: true } : perfilGoogle)),
    )
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(PaginaConta)))
    expect(await screen.findByText('perfil@exemplo.local')).toBeTruthy()
    expect(screen.queryByLabelText('Senha atual')).toBeNull()

    fireEvent.change(screen.getByLabelText('Nova senha'), { target: { value: 'senha-nova-123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))

    expect(await screen.findByLabelText('Senha atual')).toBeTruthy()
  })

  it('configurações oferece link para a conta', () => {
    render(comProvedores(createElement(ConfiguracoesPage)))
    expect(screen.getByRole('link', { name: 'Minha conta' }).getAttribute('href')).toBe('/conta')
  })
})
