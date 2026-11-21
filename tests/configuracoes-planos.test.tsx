// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ConfiguracoesPage from '@/app/(app)/configuracoes/page'
import PlanosPage from '@/app/(app)/planos/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'
import { CHAVE_PREFERENCIAS } from '@/lib/config/preferencias'

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

describe('configurações e planos', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('persiste tema, idioma, movimento, auto-sync e tamanho de texto', async () => {
    const { container } = render(comProvedores(createElement(ConfiguracoesPage)))

    fireEvent.click(screen.getByRole('button', { name: 'Escuro' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reduzido' }))
    fireEvent.click(screen.getByLabelText('Envio automático'))
    fireEvent.click(screen.getByRole('button', { name: 'Grande' }))
    fireEvent.change(screen.getByLabelText('Idioma'), { target: { value: 'en' } })

    await waitFor(() => {
      const salvo = JSON.parse(
        window.localStorage.getItem(CHAVE_PREFERENCIAS) ?? '{}',
      )
      expect(salvo).toMatchObject({
        tema: 'escuro',
        idioma: 'en',
        movimento: 'reduzido',
        autoSync: false,
        tamanhoTexto: 'grande',
      })
    })

    expect(document.documentElement.dataset.theme).toBe('escuro')
    expect(document.documentElement.dataset.motion).toBe('reduzido')
    expect(document.documentElement.dataset.texto).toBe('grande')
    expect(document.documentElement.lang).toBe('en')
    expect(container.querySelectorAll('form')).toHaveLength(1)
  })

  it('mostra quatro planos sem formulário de pagamento', () => {
    const { container } = render(comProvedores(createElement(PlanosPage)))

    for (const nome of ['Gratuito', 'Pro', 'Equipe', 'Enterprise']) {
      expect(screen.getByText(nome)).toBeTruthy()
    }
    expect(screen.getByText('R$ 29,90')).toBeTruthy()
    expect(screen.getByText('R$ 79,90')).toBeTruthy()
    expect(screen.getByText('Sob consulta')).toBeTruthy()
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(screen.queryByText(/checkout|cartão de crédito|dados de pagamento/i)).toBeNull()
  })
})
