// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ConfiguracoesPage from '@/app/(app)/configuracoes/page'
import PlanosPage from '@/app/(app)/planos/page'
import PaginaConta from '@/app/(app)/conta/page'
import FormularioLogin from '@/app/(publico)/login/FormularioLogin'
import ProvedorPreferencias, { usePreferencias } from '@/components/ProvedorPreferencias'
import RodapeLegal from '@/components/RodapeLegal'
import ToastProvider from '@/components/ToastProvider'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const AVISO_PTBR = 'A versão em português do Brasil prevalece em caso de divergência.'

function AlternarParaIngles() {
  const { atualizar } = usePreferencias()
  return createElement(
    'button',
    { type: 'button', onClick: () => atualizar({ idioma: 'en' }) },
    'Alternar para inglês',
  )
}

function comProvedores(conteudo: React.ReactNode) {
  return createElement(
    ProvedorPreferencias,
    null,
    createElement(ToastProvider, null, conteudo),
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('rodapé legal global', () => {
  it('oferece os três links e o aviso de prevalência em PT-BR', () => {
    render(
      createElement(
        ProvedorPreferencias,
        null,
        createElement(RodapeLegal),
        createElement(AlternarParaIngles),
      ),
    )

    const rodape = screen.getByRole('contentinfo')
    for (const [rotulo, href] of [
      ['Privacidade', '/privacidade'],
      ['Termos de Uso', '/termos'],
      ['Cookies', '/cookies'],
    ]) {
      expect(within(rodape).getByRole('link', { name: rotulo }).getAttribute('href')).toBe(href)
    }
    expect(within(rodape).getByText(AVISO_PTBR)).toBeTruthy()
  })

  it('traduz títulos e aviso ao trocar a preferência para inglês', async () => {
    render(
      createElement(
        ProvedorPreferencias,
        null,
        createElement(RodapeLegal),
        createElement(AlternarParaIngles),
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Alternar para inglês' }))

    expect((await screen.findByRole('link', { name: 'Privacy' })).getAttribute('href')).toBe(
      '/privacidade',
    )
    expect(screen.getByRole('link', { name: 'Terms of Use' }).getAttribute('href')).toBe('/termos')
    expect(screen.getByRole('link', { name: 'Cookies' }).getAttribute('href')).toBe('/cookies')
    expect(screen.getByText(/prevails in case of conflict/i)).toBeTruthy()
    expect(screen.queryByText(AVISO_PTBR)).toBeNull()
  })
})

describe('links contextuais de privacidade', () => {
  it('login destaca a condição de uso com links para privacidade e termos', () => {
    render(comProvedores(createElement(FormularioLogin)))

    expect(screen.getByText(/condição de uso/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Privacidade' }).getAttribute('href')).toBe(
      '/privacidade',
    )
    expect(screen.getByRole('link', { name: 'Termos de Uso' }).getAttribute('href')).toBe('/termos')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Voltar ao início' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Planos' }).getAttribute('href')).toBe('/planos')
  })

  it('planos mantém o aviso de referência e acrescenta links legais', () => {
    render(comProvedores(createElement(PlanosPage)))

    expect(screen.getByText('Valores de referência. Nenhuma cobrança é feita nesta versão.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Termos de Uso' }).getAttribute('href')).toBe('/termos')
    expect(screen.getByRole('link', { name: 'Privacidade' }).getAttribute('href')).toBe(
      '/privacidade',
    )
  })

  it('conta e configurações explicam que não há exportação ou exclusão self-service', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          nome: 'Ana',
          email: 'ana@exemplo.local',
          empresa: 'Climatizar',
          verificado: true,
          provedor: 'senha',
          criadoEm: '2026-11-20T10:00:00.000Z',
        }),
      ),
    )

    for (const Pagina of [PaginaConta, ConfiguracoesPage]) {
      const { container, unmount } = render(comProvedores(createElement(Pagina)))
      expect(screen.getAllByText('Privacidade e seus dados').length).toBeGreaterThan(0)
      expect(container.textContent).toContain('Não existe exportação ou exclusão self-service')
      expect(container.textContent).toContain('macedoartur1250@gmail.com')
      expect(screen.getByRole('link', { name: 'Privacidade' }).getAttribute('href')).toBe(
        '/privacidade',
      )
      unmount()
    }
  })
})
