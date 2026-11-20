// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'
import HomePage from '@/app/page'
import PaginaLogin from '@/app/login/page'

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

describe('telas principais', () => {
  it('início tem ação principal e atalhos nomeados', () => {
    render(comProvedores(createElement(HomePage)))

    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Registrar nova visita' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Configurações/ })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Planos/ })).toBeTruthy()
  })

  it('login tem rótulos associados e botão com nome estável', () => {
    render(comProvedores(createElement(PaginaLogin)))

    expect(screen.getByLabelText('E-mail')).toBeTruthy()
    expect(screen.getByLabelText('Senha')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
  })

  it('mantém foco visível e respeito a movimento reduzido nos tokens', () => {
    const css = readFileSync('src/app/globals.css', 'utf8')
    expect(css).toContain('*:focus-visible')
    expect(css).toContain('prefers-reduced-motion')
    expect(css).toContain("[data-motion='reduzido']")
  })
})
