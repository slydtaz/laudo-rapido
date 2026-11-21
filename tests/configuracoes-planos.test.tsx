// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ConfiguracoesPage from '@/app/(app)/configuracoes/page'
import PlanosPage from '@/app/(app)/planos/page'
import ProvedorConfiguracao from '@/components/ProvedorConfiguracao'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'
import { CHAVE_PREFERENCIAS, PREFERENCIAS_PADRAO } from '@/lib/config/preferencias'
import type { Configuracao } from '@/lib/configuracao/modelo'

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

function comConfiguracao(conteudo: React.ReactNode) {
  return render(comProvedores(createElement(ProvedorConfiguracao, null, conteudo)))
}

describe('configurações e planos', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
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

  it('salva textos e planos editados com PUT', async () => {
    const inicial: Configuracao = {
      versao: 1,
      textos: { loginBotao: 'Entrar configurado' },
      planos: [
        {
          id: 'planoPro',
          nome: 'Pro configurado',
          preco: 'R$ 29,90',
          dica: 'Dica configurada',
          itens: 'Tudo do Gratuito;Sem anúncios',
        },
      ],
    }
    const buscar = vi.fn().mockImplementation((_url: string, opcoes?: RequestInit) =>
      Promise.resolve(
        Response.json(
          opcoes?.method === 'PUT' ? JSON.parse(String(opcoes.body)) : inicial,
        ),
      ),
    )
    vi.stubGlobal('fetch', buscar)

    comConfiguracao(createElement(ConfiguracoesPage))

    fireEvent.change(await screen.findByLabelText('Entrar configurado'), {
      target: { value: 'Acessar agora' },
    })
    fireEvent.change(screen.getByLabelText('Pro · Nome'), {
      target: { value: 'Pro editorial' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(buscar.mock.calls.some((chamada) => chamada[1]?.method === 'PUT')).toBe(true),
    )
    const chamada = buscar.mock.calls.find((item) => item[1]?.method === 'PUT')!
    const payload = JSON.parse(String(chamada[1].body))
    expect(payload.textos.loginBotao).toBe('Acessar agora')
    expect(payload.planos.find((plano: { id: string }) => plano.id === 'planoPro').nome).toBe(
      'Pro editorial',
    )
    expect(await screen.findByText('Conteúdo salvo.')).toBeTruthy()
  })

  it('/planos usa o nome do provider sem alterar preço, aviso ou links legais', async () => {
    const config: Configuracao = {
      versao: 1,
      textos: {},
      planos: [
        {
          id: 'planoPro',
          nome: 'Pro do catálogo editorial',
          preco: 'R$ 9,99',
          dica: 'Dica vinda da configuração',
          itens: 'Tudo do Gratuito;Sem anúncios',
        },
      ],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(config)))

    const { container } = comConfiguracao(createElement(PlanosPage))

    expect(await screen.findByText('Pro do catálogo editorial')).toBeTruthy()
    expect(
      screen.getByText('Valores de referência. Nenhuma cobrança é feita nesta versão.'),
    ).toBeTruthy()
    expect(screen.getByText('R$ 29,90')).toBeTruthy()
    expect(screen.queryByText('R$ 9,99')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
    for (const rotulo of ['Termos de Uso', 'Privacidade']) {
      expect(screen.getByRole('link', { name: rotulo }).getAttribute('href')).toBe(
        rotulo === 'Privacidade' ? '/privacidade' : '/termos',
      )
    }
  })

  it('renderiza <script> vindo da configuração como texto puro', async () => {
    const nome = '<script>alert(1)</script>'
    const config: Configuracao = {
      versao: 1,
      textos: {},
      planos: [{ id: 'planoGratuito', nome, preco: 'R$ 0', dica: '', itens: '' }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(config)))

    const { container } = comConfiguracao(createElement(PlanosPage))

    expect(await screen.findByText(nome)).toBeTruthy()
    expect(container.querySelector('script')).toBeNull()
    expect(container.innerHTML).toContain('&lt;script&gt;')
  })

  it('não exibe promessas proibidas vindas da configuração', async () => {
    const config: Configuracao = {
      versao: 1,
      textos: {},
      planos: [
        {
          id: 'planoPro',
          nome: 'Pro com até 5 técnicos e SLA',
          preco: 'R$ 29,90',
          dica: 'Suporte prioritário e 12 meses de histórico',
          itens: 'API;Gerente de conta;Usuários ilimitados',
        },
      ],
    }
    const buscar = vi.fn().mockResolvedValue(Response.json(config))
    vi.stubGlobal('fetch', buscar)

    const { container } = comConfiguracao(createElement(PlanosPage))

    await waitFor(() => expect(buscar).toHaveBeenCalled())
    for (const termo of [
      'até 5 técnicos',
      'SLA',
      'suporte prioritário',
      '12 meses',
      'API',
      'gerente de conta',
      'usuários ilimitados',
    ]) {
      expect(container.textContent?.toLowerCase().includes(termo.toLowerCase()), termo).toBe(
        false,
      )
    }
    expect(screen.getByText('Pro')).toBeTruthy()
  })

  it('salvar sem editar em idioma não PT-BR não globaliza textos do idioma ativo', async () => {
    window.localStorage.setItem(
      CHAVE_PREFERENCIAS,
      JSON.stringify({ ...PREFERENCIAS_PADRAO, idioma: 'de' }),
    )
    const buscar = vi.fn().mockImplementation((_url: string, opcoes?: RequestInit) =>
      Promise.resolve(
        Response.json(
          opcoes?.method === 'PUT'
            ? JSON.parse(String(opcoes.body))
            : { versao: 1, textos: {}, planos: [] },
        ),
      ),
    )
    vi.stubGlobal('fetch', buscar)

    comConfiguracao(createElement(ConfiguracoesPage))
    fireEvent.click(await screen.findByRole('button', { name: 'Speichern' }))

    await waitFor(() =>
      expect(buscar.mock.calls.some((chamada) => chamada[1]?.method === 'PUT')).toBe(true),
    )
    const chamada = buscar.mock.calls.find((item) => item[1]?.method === 'PUT')!
    const corpo = String(chamada[1].body)
    const payload = JSON.parse(corpo)
    expect(payload.textos).toEqual({})
    expect(payload.planos).toEqual([])
    for (const vazamento of ['Anmelden', 'Entrar', 'Einfache Tarife', 'Auf Anfrage']) {
      expect(corpo.includes(vazamento), vazamento).toBe(false)
    }
  })

  it('envia apenas a chave editada e mostra o aviso de alcance global', async () => {
    const buscar = vi.fn().mockImplementation((_url: string, opcoes?: RequestInit) =>
      Promise.resolve(
        Response.json(
          opcoes?.method === 'PUT'
            ? JSON.parse(String(opcoes.body))
            : { versao: 1, textos: {}, planos: [] },
        ),
      ),
    )
    vi.stubGlobal('fetch', buscar)

    comConfiguracao(createElement(ConfiguracoesPage))

    expect(screen.getByText('Os textos editados valem para todos os idiomas.')).toBeTruthy()
    fireEvent.change(await screen.findByLabelText('Entrar'), {
      target: { value: 'Acessar agora' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(buscar.mock.calls.some((chamada) => chamada[1]?.method === 'PUT')).toBe(true),
    )
    const chamada = buscar.mock.calls.find((item) => item[1]?.method === 'PUT')!
    const payload = JSON.parse(String(chamada[1].body))
    expect(payload.textos).toEqual({ loginBotao: 'Acessar agora' })
    expect(payload.planos).toEqual([])
    expect(payload.versao).toBe(1)
  })
})
