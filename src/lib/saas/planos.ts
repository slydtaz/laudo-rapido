import type { PlanoConfig } from '@/lib/configuracao/modelo'
import type { ChaveTexto } from '@/lib/i18n/dicionario'

/** Identificadores estáveis. A configuração sobrepõe textos, nunca preços. */
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

/** O catálogo de domínio e a configuração usam ids diferentes. */
export const ID_CONFIG_POR_PLANO: Record<IdPlano, PlanoConfig['id']> = {
  gratuito: 'planoGratuito',
  pro: 'planoPro',
  equipe: 'planoEquipe',
  empresas: 'planoEmpresas',
}

export type CampoTextoPlano = 'nome' | 'dica' | 'itens'

/**
 * Promessas que o produto não entrega. Uma configuração editada não pode
 * reintroduzi-las na vitrine: o texto do catálogo volta a valer.
 */
const PROMESSAS_PROIBIDAS = [
  'até 5 técnicos',
  '5 técnicos',
  'up to 5',
  'hasta 5',
  "jusqu'à 5",
  'jusqu’à 5',
  'bis zu 5',
  '5 technicians',
  '5 techniciens',
  '5 technikern',
  'gerente de conta',
  'marca própria',
  'marca da empresa',
  'modelos personalizados',
  '12 meses',
  '12 months',
  'suporte prioritário',
  'priority support',
  'usuários ilimitados',
  'usuarios ilimitados',
  'unlimited users',
]

const SIGLAS_PROIBIDAS = /\b(?:api|sla)\b/i

/** "até 5 técnicos" e "ate 5 tecnicos" precisam cair na mesma barreira. */
function semAcento(valor: string): string {
  return valor.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

const PROMESSAS_NORMALIZADAS = PROMESSAS_PROIBIDAS.map(semAcento)

export function textoPlanoPermitido(valor: string | undefined, base: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0) return base
  if (SIGLAS_PROIBIDAS.test(valor)) return base
  const normalizado = semAcento(valor)
  if (PROMESSAS_NORMALIZADAS.some((termo) => normalizado.includes(termo))) return base
  return valor
}

/** Só nome, dica e itens podem ser sobrescritos; preço vem sempre do catálogo. */
export function textoPlano(
  plano: PlanoCatalogo,
  campo: CampoTextoPlano,
  sobreposicao: PlanoConfig | undefined,
  traduzir: (chave: ChaveTexto) => string,
): string {
  return textoPlanoPermitido(sobreposicao?.[campo], traduzir(plano[campo]))
}
