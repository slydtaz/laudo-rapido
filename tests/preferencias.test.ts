// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'

import {
  CHAVE_PREFERENCIAS,
  PREFERENCIAS_PADRAO,
  aplicarPreferencias,
  lerPreferencias,
  salvarPreferencias,
} from '@/lib/config/preferencias'

describe('preferências locais', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('devolve os padrões quando não há nada salvo', () => {
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO)
  })

  it('devolve os padrões quando o JSON está corrompido', () => {
    localStorage.setItem(CHAVE_PREFERENCIAS, '{isso não é json')
    expect(lerPreferencias()).toEqual(PREFERENCIAS_PADRAO)
  })

  it('preenche campos ausentes com os padrões', () => {
    localStorage.setItem(CHAVE_PREFERENCIAS, JSON.stringify({ idioma: 'es' }))
    expect(lerPreferencias()).toEqual({ ...PREFERENCIAS_PADRAO, idioma: 'es' })
  })

  it('descarta valores inválidos sem apagar os válidos', () => {
    localStorage.setItem(
      CHAVE_PREFERENCIAS,
      JSON.stringify({ tema: 'neon', idioma: 'fr', movimento: 'talvez', autoSync: 'sim' }),
    )
    expect(lerPreferencias()).toEqual({
      ...PREFERENCIAS_PADRAO,
      idioma: 'fr',
    })
  })

  it('aplica tema, movimento, tamanho e idioma no documento', () => {
    aplicarPreferencias(
      {
        ...PREFERENCIAS_PADRAO,
        tema: 'escuro',
        movimento: 'reduzido',
        tamanhoTexto: 'grande',
        idioma: 'fr',
      },
      true,
    )
    expect(document.documentElement.dataset.theme).toBe('escuro')
    expect(document.documentElement.dataset.motion).toBe('reduzido')
    expect(document.documentElement.dataset.texto).toBe('grande')
    expect(document.documentElement.lang).toBe('fr')
  })

  it('resolve o tema sistema pela preferência do sistema operacional', () => {
    aplicarPreferencias(PREFERENCIAS_PADRAO, true)
    expect(document.documentElement.dataset.theme).toBe('escuro')
    aplicarPreferencias(PREFERENCIAS_PADRAO, false)
    expect(document.documentElement.dataset.theme).toBe('claro')
  })

  it('salva e lê de volta', () => {
    const preferencias = {
      tema: 'escuro' as const,
      idioma: 'de' as const,
      movimento: 'reduzido' as const,
      autoSync: false,
      tamanhoTexto: 'grande' as const,
    }
    salvarPreferencias(preferencias)
    expect(lerPreferencias()).toEqual(preferencias)
  })
})
