// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import PaginaCookies from '@/app/(publico)/cookies/page'
import PaginaPrivacidade from '@/app/(publico)/privacidade/page'
import PaginaTermos from '@/app/(publico)/termos/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'

const VIGENCIA = '21/11/2026'
const AVISO_PTBR = 'A versão em português do Brasil prevalece em caso de divergência.'

const PAGINAS = [
  ['Privacidade', PaginaPrivacidade, 'Política de Privacidade'],
  ['Termos', PaginaTermos, 'Termos de Uso'],
  ['Cookies', PaginaCookies, 'Política de Cookies'],
] as const

function renderizar(Pagina: (props: Record<string, never>) => React.JSX.Element) {
  return render(createElement(ProvedorPreferencias, null, createElement(Pagina)))
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

describe('páginas legais públicas', () => {
  it.each(PAGINAS)('%s mostra título, vigência e aviso de idioma', (_nome, Pagina, titulo) => {
    renderizar(Pagina)

    expect(screen.getByRole('heading', { level: 1, name: titulo })).toBeTruthy()
    expect(screen.getByText(VIGENCIA)).toBeTruthy()
    expect(screen.getByText(AVISO_PTBR)).toBeTruthy()
  })

  it('nenhuma página injeta HTML', () => {
    for (const caminho of [
      'src/app/(publico)/privacidade/page.tsx',
      'src/app/(publico)/termos/page.tsx',
      'src/app/(publico)/cookies/page.tsx',
    ]) {
      const fonte = readFileSync(caminho, 'utf8')
      expect(fonte.includes('dangerouslySetInnerHTML'), caminho).toBe(false)
    }
  })

  it('privacidade traz controlador, contato e retenção honesta', () => {
    const { container } = renderizar(PaginaPrivacidade)

    for (const frase of [
      'Artur Fernandes Macêdo Vinhas',
      'macedoartur1250@gmail.com',
      'Fotos e assinaturas são enviadas ao Cloudflare R2 e ficam com URL pública.',
      'Não existe hoje rotina automática de expurgo; pedidos são atendidos manualmente pelo canal de contato.',
      'O tratamento desses dados é condição para usar o serviço.',
    ]) {
      expect(container.textContent, frase).toContain(frase)
    }
  })

  it('cookies lista os mecanismos reais e nega rastreadores', () => {
    const { container } = renderizar(PaginaCookies)

    for (const frase of [
      'sessao',
      'oauth',
      'laudo-rapido:preferencias:v1',
      'laudo-rapido-offline',
      'Não há analytics, anúncios, pixels, perfilamento ou rastreadores de terceiros.',
      'Por isso, não exibimos banner de consentimento nesta versão.',
    ]) {
      expect(container.textContent, frase).toContain(frase)
    }
  })

  it('termos declaram ausência de cobrança e lei aplicável', () => {
    const { container } = renderizar(PaginaTermos)

    for (const frase of [
      'Nenhuma cobrança é feita nesta versão.',
      'Lei brasileira e foro da comarca do controlador.',
    ]) {
      expect(container.textContent, frase).toContain(frase)
    }
  })
})
