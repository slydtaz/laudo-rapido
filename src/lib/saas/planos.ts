import type { ChaveTexto } from '@/lib/i18n/dicionario'

/** Identificadores estáveis: uma futura API de configuração poderá sobrepor preços sem rebuild. */
export type IdPlano = 'gratuito' | 'pro' | 'equipe' | 'empresas'

export type PlanoCatalogo = {
  id: IdPlano
  nome: ChaveTexto
  preco: ChaveTexto
  /** Valor em reais para a futura cobrança; null quando não há valor fechado. */
  precoNumero: number | null
  dica: ChaveTexto
  itens: ChaveTexto
  destaque?: boolean
  /** Planos sem o sufixo "/ mês". */
  semPeriodo?: boolean
}

export const CATALOGO_PLANOS: PlanoCatalogo[] = [
  {
    id: 'gratuito',
    nome: 'planoGratuito',
    preco: 'planoGratuitoPreco',
    precoNumero: 0,
    dica: 'planoGratuitoDica',
    itens: 'planoGratuitoItens',
    semPeriodo: true,
  },
  {
    id: 'pro',
    nome: 'planoPro',
    preco: 'planoProPreco',
    precoNumero: 29.9,
    dica: 'planoProDica',
    itens: 'planoProItens',
    destaque: true,
  },
  {
    id: 'equipe',
    nome: 'planoEquipe',
    preco: 'planoEquipePreco',
    precoNumero: 79.9,
    dica: 'planoEquipeDica',
    itens: 'planoEquipeItens',
  },
  {
    id: 'empresas',
    nome: 'planoEmpresas',
    preco: 'planoEmpresasPreco',
    precoNumero: null,
    dica: 'planoEmpresasDica',
    itens: 'planoEmpresasItens',
    semPeriodo: true,
  },
]
