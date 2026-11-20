import { describe, expect, it } from 'vitest'

import { IDIOMAS_TEXTOS, ptBR } from '../src/lib/i18n/dicionario'

const IDIOMAS = ['ptBR', 'en', 'es', 'fr', 'de'] as const

describe('vitrine de planos', () => {
  it('usa preços acessíveis nas faixas pagas', () => {
    expect(ptBR.planoGratuitoPreco).toBe('R$ 0')
    expect(ptBR.planoProPreco).toBe('R$ 19,90')
    expect(ptBR.planoEquipePreco).toBe('R$ 39,90')
    expect(ptBR.planoEmpresasPreco).toBe('Sob consulta')
  })

  it('oferece a camada Enterprise em todos os idiomas', () => {
    for (const idioma of IDIOMAS) {
      const textos = IDIOMAS_TEXTOS[idioma]
      expect(textos.planoEmpresas, idioma).toBe('Enterprise')
      expect(textos.planoEquipe.length, idioma).toBeGreaterThan(0)
      expect(textos.planoEquipePreco.length, idioma).toBeGreaterThan(0)
      expect(textos.planoEquipeDica.length, idioma).toBeGreaterThan(0)
      expect(textos.planoEquipeItens.length, idioma).toBeGreaterThan(0)
      expect(textos.planosFaq3P.length, idioma).toBeGreaterThan(0)
      expect(textos.planosFaq3R.length, idioma).toBeGreaterThan(0)
    }
  })
})
