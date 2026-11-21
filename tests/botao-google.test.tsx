// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import FormularioLogin from '@/app/(publico)/login/FormularioLogin'
import FormularioRegistro from '@/app/registro/FormularioRegistro'
import BotaoGoogle from '@/components/BotaoGoogle'
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

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('botão Continuar com Google', () => {
  it('aponta para a rota OAuth, com ícone decorativo e alvo de 44 px', () => {
    render(comProvedores(createElement(BotaoGoogle)))

    const botao = screen.getByRole('link', { name: 'Continuar com Google' })
    expect(botao.getAttribute('href')).toBe('/api/v1/auth/google')
    expect(botao.className).toContain('min-h-11')
    expect(botao.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('aceita rótulo customizado', () => {
    render(comProvedores(createElement(BotaoGoogle, { rotulo: 'Entrar com Google' })))
    expect(screen.getByRole('link', { name: 'Entrar com Google' })).toBeTruthy()
  })

  it('está presente no login e no registro', () => {
    const login = render(comProvedores(createElement(FormularioLogin)))
    expect(screen.getByRole('link', { name: 'Continuar com Google' })).toBeTruthy()
    expect(screen.getByText('ou')).toBeTruthy()
    login.unmount()

    render(comProvedores(createElement(FormularioRegistro)))
    expect(screen.getByRole('link', { name: 'Continuar com Google' })).toBeTruthy()
    expect(screen.getByText('ou')).toBeTruthy()
  })
})
