// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import FormularioLogin from '@/app/(publico)/login/FormularioLogin'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'
import { IDIOMAS_TEXTOS } from '@/lib/i18n/dicionario'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('card de alerta do login', () => {
  it('mostra aviso de acesso restrito para todos', () => {
    render(
      createElement(
        ProvedorPreferencias,
        null,
        createElement(ToastProvider, null, createElement(FormularioLogin)),
      ),
    )

    const alerta = screen.getByRole('status')
    expect(alerta.textContent).toContain('Área em preparação')
    expect(alerta.textContent).toContain(
      'Acesso restrito ao responsável. Outras contas são bloqueadas automaticamente.',
    )
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
  })

  it('tem as duas chaves nos cinco idiomas', () => {
    for (const idioma of ['ptBR', 'en', 'es', 'fr', 'de'] as const) {
      expect(IDIOMAS_TEXTOS[idioma].loginAvisoManutencaoTitulo.length).toBeGreaterThan(0)
      expect(IDIOMAS_TEXTOS[idioma].loginAvisoManutencaoTexto.length).toBeGreaterThan(0)
    }
  })
})
