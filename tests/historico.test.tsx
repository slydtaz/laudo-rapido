// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HistoricoPage from '@/app/visitas/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'

const VISITAS = [
  {
    id: 'visita-1',
    token: 'token-1',
    status: 'sincronizada',
    dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'Filtro trocado' },
    capturadoEm: '2026-11-20T10:00:00.000Z',
    criadoEm: null,
  },
  {
    id: 'visita-2',
    token: 'token-2',
    status: 'entregue',
    dados: { cliente: 'Hotel Aurora', tipo: 'Elétrica', observacoes: 'Quadro revisado' },
    capturadoEm: '2026-11-19T10:00:00.000Z',
    criadoEm: null,
  },
]

function comProvedores(conteudo: React.ReactNode) {
  return createElement(
    ProvedorPreferencias,
    null,
    createElement(ToastProvider, null, conteudo),
  )
}

describe('histórico de laudos', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('mostra skeleton e depois os laudos recebidos da API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ visitas: VISITAS })))

    render(comProvedores(createElement(HistoricoPage)))

    expect(screen.getByRole('status', { name: 'Carregando…' })).toBeTruthy()
    expect(await screen.findByText('Padaria Central')).toBeTruthy()
    expect(screen.getByText('Hotel Aurora')).toBeTruthy()
    expect(screen.getByText('2 laudos')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Carregando…' })).toBeNull())
  })

  it('filtra por cliente enquanto o usuário digita', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ visitas: VISITAS })))

    render(comProvedores(createElement(HistoricoPage)))
    await screen.findByText('Padaria Central')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar laudo' }), {
      target: { value: 'aurora' },
    })

    expect(screen.getByText('Hotel Aurora')).toBeTruthy()
    expect(screen.queryByText('Padaria Central')).toBeNull()
    expect(screen.getByText('1 laudos')).toBeTruthy()
  })

  it('oferece nova tentativa quando a API falha', async () => {
    const buscar = vi.fn().mockRejectedValueOnce(new Error('sem rede'))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(HistoricoPage)))
    expect(await screen.findByText('Não foi possível carregar o histórico. Verifique sua conexão.')).toBeTruthy()

    buscar.mockResolvedValueOnce(Response.json({ visitas: VISITAS }))
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    expect(await screen.findByText('Padaria Central')).toBeTruthy()
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('exibe estado vazio quando não há laudos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ visitas: [] })))

    render(comProvedores(createElement(HistoricoPage)))
    expect(
      await screen.findByText('Nenhum laudo encontrado. Registre uma visita ou ajuste a busca.'),
    ).toBeTruthy()
    expect(screen.queryByText('Padaria Central')).toBeNull()
  })
})
