// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HomePage from '@/app/(app)/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

vi.mock('@/lib/offline/queue', () => ({
  pendenciasRestantes: vi.fn().mockResolvedValue(3),
  entregasSalvas: vi.fn().mockResolvedValue([{ id: 'a' }, { id: 'b' }]),
}))

function comProvedores(conteudo: React.ReactNode) {
  return createElement(
    ProvedorPreferencias,
    null,
    createElement(ToastProvider, null, conteudo),
  )
}

describe('resumo local na home', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('mostra pendências e entregas da fila quando há sessão', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ empresaId: 'empresa-1' })),
    )

    render(comProvedores(createElement(HomePage)))

    expect(await screen.findByText('Seu resumo')).toBeTruthy()
    await waitFor(() => {
      const valores = screen.getAllByText(/^\d+$/).map((no) => no.textContent)
      expect(valores).toContain('3')
      expect(valores).toContain('2')
    })
  })

  it('mantém o resumo em zero quando não há sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({})))

    render(comProvedores(createElement(HomePage)))

    expect(await screen.findByText('Seu resumo')).toBeTruthy()
    const valores = screen.getAllByText(/^\d+$/).map((no) => no.textContent)
    expect(valores.every((valor) => valor === '0')).toBe(true)
  })
})
