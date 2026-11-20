// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import Skeleton from '@/components/Skeleton'
import ToastProvider, { useToast } from '@/components/ToastProvider'

function comProvedor(conteudo: React.ReactNode) {
  return createElement(ProvedorPreferencias, null, createElement(ToastProvider, null, conteudo))
}

describe('feedback de carregamento', () => {
  it('reserva espaço e expõe estado ocupado', () => {
    render(createElement(Skeleton, { linhas: 3 }))
    const area = screen.getByRole('status')
    expect(area.getAttribute('aria-busy')).toBe('true')
    expect(area.querySelectorAll('.skeleton').length).toBe(4)
  })

  it('anuncia o toast em região viva', async () => {
    function Amostra() {
      const { avisar } = useToast()
      return createElement('button', { onClick: () => avisar('Pronto') }, 'Avisar')
    }

    render(comProvedor(createElement(Amostra)))
    fireEvent.click(screen.getByText('Avisar'))

    expect(await screen.findByText('Pronto')).toBeTruthy()
    expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  })

  it('marca erros como alerta', async () => {
    function Amostra() {
      const { avisar } = useToast()
      return createElement(
        'button',
        { onClick: () => avisar('Falhou', 'erro') },
        'Falhar',
      )
    }

    render(comProvedor(createElement(Amostra)))
    fireEvent.click(screen.getByText('Falhar'))

    expect(await screen.findByText('Falhou')).toBeTruthy()
    expect(document.querySelector('[role="alert"]')).toBeTruthy()
  })
})
