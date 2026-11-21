// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'

import PlanosPage from '@/app/(app)/planos/page'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import { IDIOMAS_TEXTOS, ptBR } from '@/lib/i18n/dicionario'
import { CATALOGO_PLANOS, textoPlanoPermitido } from '@/lib/saas/planos'

const IDIOMAS = ['ptBR', 'en', 'es', 'fr', 'de'] as const

const CHAVES_ITENS = [
  'planoGratuitoItens',
  'planoProItens',
  'planoEquipeItens',
  'planoEmpresasItens',
] as const

const TERMOS_PROIBIDOS = [
  'API',
  'SLA',
  'Gerente de conta',
  'Marca da empresa',
  'Modelos personalizados',
  '12 meses',
  'Usuários ilimitados',
  'Suporte prioritário',
]

const TERMOS_CONTAGEM_TECNICOS = [
  '5 técnicos',
  '5 techniciens',
  '5 technicians',
  '5 Technikern',
  'até 5',
  'up to 5',
  'hasta 5',
  "jusqu'à 5",
  'jusqu’à 5',
  'bis zu 5',
]

const PRECO_POR_NUMERO = new Map<number | null, string>([
  [0, 'R$ 0'],
  [29.9, 'R$ 29,90'],
  [79.9, 'R$ 79,90'],
  [null, 'Sob consulta'],
])

describe('catálogo de domínio dos planos', () => {
  it('tem exatamente quatro planos com ids estáveis', () => {
    expect(CATALOGO_PLANOS.map((plano) => plano.id)).toEqual([
      'gratuito',
      'pro',
      'equipe',
      'empresas',
    ])
  })

  it('usa precoNumero 0, 29.9, 79.9 e null nessa ordem', () => {
    expect(CATALOGO_PLANOS.map((plano) => plano.precoNumero)).toEqual([0, 29.9, 79.9, null])
  })

  it('marca Gratuito e Enterprise sem período e Pro em destaque', () => {
    expect(CATALOGO_PLANOS.find((plano) => plano.id === 'gratuito')?.semPeriodo).toBe(true)
    expect(CATALOGO_PLANOS.find((plano) => plano.id === 'empresas')?.semPeriodo).toBe(true)
    expect(CATALOGO_PLANOS.find((plano) => plano.id === 'pro')?.destaque).toBe(true)
  })

  it('mantém precoNumero consistente com o preço exibido em ptBR', () => {
    for (const plano of CATALOGO_PLANOS) {
      expect(ptBR[plano.preco], plano.id).toBe(PRECO_POR_NUMERO.get(plano.precoNumero))
    }
  })
})

describe('textos honestos da vitrine', () => {
  it('não promete recursos não implementados nos itens em ptBR', () => {
    for (const chave of CHAVES_ITENS) {
      const itens = ptBR[chave].toLowerCase()
      for (const termo of TERMOS_PROIBIDOS) {
        expect(itens.includes(termo.toLowerCase()), `${chave}: ${termo}`).toBe(false)
      }
    }
  })

  it('não anuncia contagem de técnicos na vitrine em nenhum idioma', () => {
    for (const idioma of IDIOMAS) {
      const textos = IDIOMAS_TEXTOS[idioma]
      const copia = CATALOGO_PLANOS.flatMap((plano) => [
        textos[plano.nome],
        textos[plano.dica],
        textos[plano.itens],
      ])
        .join(' ')
        .toLowerCase()
      for (const termo of TERMOS_CONTAGEM_TECNICOS) {
        expect(copia.includes(termo.toLowerCase()), `${idioma}: ${termo}`).toBe(false)
      }
    }
  })

  it('usa os itens exatos aprovados para cada plano', () => {
    expect(ptBR.planoGratuitoItens).toBe(
      'Visitas ilimitadas;Fotos e assinatura;Laudo em PDF;Sincronização offline;Histórico no aparelho',
    )
    expect(ptBR.planoProItens).toBe('Tudo do Gratuito;Uso profissional;Sem anúncios')
    expect(ptBR.planoEquipeItens).toBe(
      'Tudo do Pro;Uso compartilhado da conta;Organização por empresa',
    )
    expect(ptBR.planoEmpresasItens).toBe(
      'Escopo sob consulta;Contrato direto;Sem cobrança nesta versão',
    )
  })

  it('mantém o aviso de referência sem cobrança', () => {
    expect(ptBR.planosAviso).toBe('Valores de referência. Nenhuma cobrança é feita nesta versão.')
  })

  it('rejeita promessa proibida mesmo sem acentos', () => {
    expect(textoPlanoPermitido('até 5 tecnicos', 'Plano honesto')).toBe('Plano honesto')
    expect(textoPlanoPermitido('5 tecnicos', 'Plano honesto')).toBe('Plano honesto')
    expect(textoPlanoPermitido('Suporte prioritario', 'Plano honesto')).toBe('Plano honesto')
    expect(textoPlanoPermitido('Usuarios ilimitados', 'Plano honesto')).toBe('Plano honesto')
  })

  it('repete os preços em reais e o rótulo Enterprise nos cinco idiomas', () => {
    for (const idioma of IDIOMAS) {
      const textos = IDIOMAS_TEXTOS[idioma]
      expect(textos.planoGratuitoPreco, idioma).toBe('R$ 0')
      expect(textos.planoProPreco, idioma).toBe('R$ 29,90')
      expect(textos.planoEquipePreco, idioma).toBe('R$ 79,90')
      expect(textos.planoEmpresasPreco.length, idioma).toBeGreaterThan(0)
      expect(textos.planoEmpresas, idioma).toBe('Enterprise')
    }
  })
})

describe('render da vitrine de planos', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('mostra os preços R$ 29,90 e R$ 79,90 e não os preços antigos', () => {
    render(createElement(ProvedorPreferencias, null, createElement(PlanosPage)))

    expect(screen.getByText('R$ 29,90')).toBeTruthy()
    expect(screen.getByText('R$ 79,90')).toBeTruthy()
    expect(screen.queryByText('R$ 19,90')).toBeNull()
    expect(screen.queryByText('R$ 39,90')).toBeNull()
  })
})
