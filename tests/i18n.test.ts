// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import ProvedorConfiguracao from '@/components/ProvedorConfiguracao'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import { CHAVE_PREFERENCIAS, PREFERENCIAS_PADRAO } from '@/lib/config/preferencias'
import { IDIOMAS_TEXTOS, ptBR } from '@/lib/i18n/dicionario'
import { useT } from '@/lib/i18n/useT'

const IDIOMAS = ['ptBR', 'en', 'es', 'fr', 'de'] as const

function AmostraTexto() {
  const t = useT()
  return createElement('span', null, t('loginBotao'))
}

function comConfiguracao(conteudo: ReactNode) {
  return render(
    createElement(
      ProvedorPreferencias,
      null,
      createElement(ProvedorConfiguracao, null, conteudo),
    ),
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.localStorage.clear()
})

describe('dicionário de idiomas', () => {
  it('oferece exatamente cinco idiomas', () => {
    expect(Object.keys(IDIOMAS_TEXTOS)).toEqual([...IDIOMAS])
  })

  it('mantém as mesmas chaves em todos os idiomas', () => {
    const chaves = Object.keys(ptBR).sort()
    for (const idioma of IDIOMAS) {
      expect(Object.keys(IDIOMAS_TEXTOS[idioma]).sort(), idioma).toEqual(chaves)
    }
  })

  it('não deixa textos vazios', () => {
    for (const idioma of IDIOMAS) {
      for (const [chave, texto] of Object.entries(IDIOMAS_TEXTOS[idioma])) {
        expect(texto.trim().length, `${idioma}.${chave}`).toBeGreaterThan(0)
      }
    }
  })

  it('usa o idioma salvo e atualiza o atributo lang', async () => {
    localStorage.setItem(
      CHAVE_PREFERENCIAS,
      JSON.stringify({ ...PREFERENCIAS_PADRAO, idioma: 'en' }),
    )

    function Amostra() {
      const t = useT()
      return createElement('span', null, t('loginBotao'))
    }

    render(createElement(ProvedorPreferencias, null, createElement(Amostra)))

    expect(await screen.findByText('Sign in')).toBeTruthy()
    expect(document.documentElement.lang).toBe('en')
  })

  it('oferece o rótulo do resumo local na home em todos os idiomas', () => {
    for (const idioma of IDIOMAS) {
      expect(IDIOMAS_TEXTOS[idioma].homeResumo.length, idioma).toBeGreaterThan(0)
    }
  })

  it('preserva os rótulos usados pelos testes de smoke em PT-BR', () => {
    expect(ptBR.loginBotao).toBe('Entrar')
    expect(ptBR.homeAcao).toBe('Registrar nova visita')
    expect(ptBR.visitaSalvar).toBe('Salvar visita no aparelho')
    expect(ptBR.visitaSincronizar).toBe('Sincronizar agora')
    expect(ptBR.visitaCopiar).toBe('Copiar link')
    expect(ptBR.relatorioBaixar).toBe('Baixar PDF')
  })

  it('oferece chaves de conteúdo nos cinco idiomas sem alterar configSalvo', () => {
    expect(ptBR.configSalvo).toBe('Preferência salva.')
    expect(ptBR.configConteudoSalvo).toBe('Conteúdo salvo.')
    for (const idioma of IDIOMAS) {
      for (const chave of [
        'configSalvar',
        'configConteudo',
        'configTextos',
        'configPlanos',
        'configTextosAvisoGlobal',
        'configConteudoSalvo',
      ] as const) {
        expect(IDIOMAS_TEXTOS[idioma][chave].trim().length, `${idioma}.${chave}`).toBeGreaterThan(
          0,
        )
      }
    }
  })
})

describe('tradução dinâmica', () => {
  it('usa o override do provedor de configuração antes do dicionário', async () => {
    const buscar = vi.fn().mockResolvedValue(
      Response.json({ versao: 1, textos: { loginBotao: 'Acessar agora' }, planos: [] }),
    )
    vi.stubGlobal('fetch', buscar)

    comConfiguracao(createElement(AmostraTexto))

    expect(await screen.findByText('Acessar agora')).toBeTruthy()
    expect(buscar).toHaveBeenCalledWith('/api/v1/configuracao')
  })

  it('sem provedor de configuração devolve o dicionário local', () => {
    const buscar = vi.fn()
    vi.stubGlobal('fetch', buscar)

    render(createElement(ProvedorPreferencias, null, createElement(AmostraTexto)))

    expect(screen.getByText('Entrar')).toBeTruthy()
    expect(buscar).not.toHaveBeenCalled()
  })

  it('se a busca da configuração falhar, mantém o dicionário', async () => {
    const buscar = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', buscar)

    comConfiguracao(createElement(AmostraTexto))

    await waitFor(() => expect(buscar).toHaveBeenCalled())
    expect(screen.getByText('Entrar')).toBeTruthy()
    expect(screen.queryByText('Acessar agora')).toBeNull()
  })
})
