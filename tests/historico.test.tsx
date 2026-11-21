// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HistoricoPage from '@/app/(app)/visitas/page'
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

function definirEstadoNavegador(visivel: boolean, online: boolean) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: visivel ? 'visible' : 'hidden',
  })
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: online })
}

function usarRelogioDoIntervalo() {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
}

describe('histórico de laudos', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    definirEstadoNavegador(true, true)
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

  it('atualiza automaticamente a cada 30 s e avança o horário exibido', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.setSystemTime(new Date('2026-11-21T10:00:00.000Z'))
    definirEstadoNavegador(true, true)
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ visitas: VISITAS }))
      .mockResolvedValueOnce(Response.json({ visitas: VISITAS }))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(HistoricoPage)))
    expect(await screen.findByText('Padaria Central')).toBeTruthy()
    expect(buscar).toHaveBeenCalledTimes(1)

    const horarioInicial = (await screen.findByText(/Atualizado às/)).textContent
    expect(horarioInicial).toBeTruthy()

    vi.setSystemTime(new Date('2026-11-21T10:01:00.000Z'))
    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(buscar).toHaveBeenCalledTimes(2)
    const horarioAtualizado = (await screen.findByText(/Atualizado às/)).textContent
    expect(horarioAtualizado).not.toBe(horarioInicial)
  })

  it('não consulta a API a cada 30 s com a aba oculta ou sem rede', async () => {
    usarRelogioDoIntervalo()
    const buscar = vi.fn().mockResolvedValue(Response.json({ visitas: VISITAS }))
    vi.stubGlobal('fetch', buscar)

    definirEstadoNavegador(false, true)
    render(comProvedores(createElement(HistoricoPage)))
    expect(await screen.findByText('Padaria Central')).toBeTruthy()
    expect(buscar).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(buscar).toHaveBeenCalledTimes(1)

    definirEstadoNavegador(true, false)
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(buscar).toHaveBeenCalledTimes(1)
  })

  it('mantém a lista antiga visível durante a atualização, sem skeleton', async () => {
    usarRelogioDoIntervalo()
    definirEstadoNavegador(true, true)
    let resolverSegunda: (resposta: Response) => void = () => undefined
    const segundaRequisicao = new Promise<Response>((resolve) => {
      resolverSegunda = resolve
    })
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ visitas: VISITAS }))
      .mockReturnValueOnce(segundaRequisicao)
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(HistoricoPage)))
    expect(await screen.findByText('Padaria Central')).toBeTruthy()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(buscar).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Padaria Central')).toBeTruthy()
    expect(screen.getByText('Hotel Aurora')).toBeTruthy()
    expect(screen.queryByRole('status', { name: 'Carregando…' })).toBeNull()

    await act(async () => {
      resolverSegunda(
        Response.json({
          visitas: [
            { ...VISITAS[0], dados: { ...VISITAS[0].dados, cliente: 'Padaria Atualizada' } },
            VISITAS[1],
          ],
        }),
      )
      await segundaRequisicao
    })

    expect(screen.getByText('Padaria Atualizada')).toBeTruthy()
    expect(screen.queryByText('Padaria Central')).toBeNull()
    expect(screen.getByText(/Atualizado às/)).toBeTruthy()
  })

  it('recupera automaticamente o erro inicial quando a atualização em segundo plano sucede', async () => {
    usarRelogioDoIntervalo()
    definirEstadoNavegador(true, true)
    const mensagemErro = 'Não foi possível carregar o histórico. Verifique sua conexão.'
    const buscar = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ visitas: VISITAS }))
    vi.stubGlobal('fetch', buscar)

    render(comProvedores(createElement(HistoricoPage)))
    expect(await screen.findByText(mensagemErro)).toBeTruthy()
    expect(screen.queryByText('Padaria Central')).toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(30_000)
    })

    expect(buscar).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(screen.queryByText(mensagemErro)).toBeNull())
    expect(screen.getByText('Padaria Central')).toBeTruthy()
    expect(screen.getByText('Hotel Aurora')).toBeTruthy()
    expect(screen.getByText(/Atualizado às/)).toBeTruthy()
  })
})
