// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import RegistradorSW from '@/components/RegistradorSW'
import ToastProvider from '@/components/ToastProvider'

type Ouvinte = () => void
type MapaOuvintes = Record<string, Ouvinte[]>

function registrarOuvinte(mapa: MapaOuvintes, nome: string, callback: Ouvinte) {
  mapa[nome] = [...(mapa[nome] ?? []), callback]
}

function disparar(mapa: MapaOuvintes, nome: string) {
  for (const callback of mapa[nome] ?? []) callback()
}

function criarMockServiceWorker() {
  const ouvintesSW: MapaOuvintes = {}
  const ouvintesRegistro: MapaOuvintes = {}
  const ouvintesWorker: MapaOuvintes = {}

  const worker = {
    state: 'installing',
    addEventListener: vi.fn((nome: string, callback: Ouvinte) =>
      registrarOuvinte(ouvintesWorker, nome, callback),
    ),
    removeEventListener: vi.fn((nome: string, callback: Ouvinte) => {
      ouvintesWorker[nome] = (ouvintesWorker[nome] ?? []).filter((ouvinte) => ouvinte !== callback)
    }),
    postMessage: vi.fn(),
  }

  const registration = {
    installing: worker as typeof worker | null,
    addEventListener: vi.fn((nome: string, callback: Ouvinte) =>
      registrarOuvinte(ouvintesRegistro, nome, callback),
    ),
    removeEventListener: vi.fn((nome: string, callback: Ouvinte) => {
      ouvintesRegistro[nome] = (ouvintesRegistro[nome] ?? []).filter(
        (ouvinte) => ouvinte !== callback,
      )
    }),
  }

  const register = vi.fn().mockResolvedValue(registration)
  const serviceWorker = {
    register,
    addEventListener: vi.fn((nome: string, callback: Ouvinte) =>
      registrarOuvinte(ouvintesSW, nome, callback),
    ),
    removeEventListener: vi.fn((nome: string, callback: Ouvinte) => {
      ouvintesSW[nome] = (ouvintesSW[nome] ?? []).filter((ouvinte) => ouvinte !== callback)
    }),
  }

  return {
    register,
    worker,
    registration,
    serviceWorker,
    dispararSW: (nome: string) => disparar(ouvintesSW, nome),
    dispararRegistro: (nome: string) => disparar(ouvintesRegistro, nome),
    dispararWorker: (nome: string) => disparar(ouvintesWorker, nome),
  }
}

function renderRegistrador() {
  return render(
    createElement(
      ProvedorPreferencias,
      null,
      createElement(ToastProvider, null, createElement(RegistradorSW)),
    ),
  )
}

describe('aviso de atualização do PWA', () => {
  const reload = vi.fn()
  let mock: ReturnType<typeof criarMockServiceWorker>

  beforeEach(() => {
    window.localStorage.clear()
    reload.mockReset()
    mock = criarMockServiceWorker()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubGlobal('location', { reload })
    Object.defineProperty(window.navigator, 'serviceWorker', {
      configurable: true,
      value: mock.serviceWorker,
    })
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    delete (window.navigator as unknown as { serviceWorker?: unknown }).serviceWorker
  })

  it('avisa a nova versão, envia SKIP_WAITING e recarrega uma única vez', async () => {
    renderRegistrador()

    await waitFor(() => {
      expect(mock.register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' })
    })

    mock.dispararRegistro('updatefound')
    mock.worker.state = 'installed'
    mock.dispararWorker('statechange')

    expect(await screen.findByText('Nova versão disponível')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(mock.worker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })

    mock.dispararSW('controllerchange')
    mock.dispararSW('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
