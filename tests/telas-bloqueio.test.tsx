// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import PaginaEmDesenvolvimento from '@/app/(publico)/em-desenvolvimento/page'
import PaginaOffline from '@/app/(publico)/offline/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'

function comProvedores(conteudo: React.ReactNode) {
  return createElement(ProvedorPreferencias, null, conteudo)
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('telas de bloqueio', () => {
  it('/em-desenvolvimento mostra o aviso sem link de login nem conteúdo editável', () => {
    const { container } = render(comProvedores(createElement(PaginaEmDesenvolvimento)))

    expect(screen.getByText('Aplicativo em desenvolvimento')).toBeTruthy()
    expect(screen.queryByRole('link', { name: /entrar|login/i })).toBeNull()
    expect(container.querySelector('input, textarea, select, [contenteditable]')).toBeNull()
  })

  it('/offline mostra o aviso de sem conexão', () => {
    render(comProvedores(createElement(PaginaOffline)))

    expect(screen.getByText('Sem conexão')).toBeTruthy()
  })
})
