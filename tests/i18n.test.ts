// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'

import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import { CHAVE_PREFERENCIAS, PREFERENCIAS_PADRAO } from '@/lib/config/preferencias'
import { IDIOMAS_TEXTOS, ptBR } from '@/lib/i18n/dicionario'
import { useT } from '@/lib/i18n/useT'

const IDIOMAS = ['ptBR', 'en', 'es', 'fr', 'de'] as const

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

  it('preserva os rótulos usados pelos testes de smoke em PT-BR', () => {
    expect(ptBR.loginBotao).toBe('Entrar')
    expect(ptBR.homeAcao).toBe('Registrar nova visita')
    expect(ptBR.visitaSalvar).toBe('Salvar visita no aparelho')
    expect(ptBR.visitaSincronizar).toBe('Sincronizar agora')
    expect(ptBR.visitaCopiar).toBe('Copiar link')
    expect(ptBR.relatorioBaixar).toBe('Baixar PDF')
  })
})
