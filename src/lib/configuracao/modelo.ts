import { z } from 'zod'

import { ptBR, type ChaveTexto } from '../i18n/dicionario'

export type PlanoConfig = {
  id: 'planoGratuito' | 'planoPro' | 'planoEquipe' | 'planoEmpresas'
  nome: string
  preco: string
  dica: string
  itens: string
}

export type Configuracao = {
  versao: number
  textos: Partial<Record<ChaveTexto, string>>
  planos: PlanoConfig[]
}

/** Ids do catálogo editável — distintos de `IdPlano` (catálogo de domínio). */
export const IDS_PLANO_CONFIG = [
  'planoGratuito',
  'planoPro',
  'planoEquipe',
  'planoEmpresas',
] as const satisfies readonly PlanoConfig['id'][]

/** Cada leitura devolve um objeto novo: nenhum chamador pode mutar o padrão. */
export function configuracaoPadrao(): Configuracao {
  return { versao: 1, textos: {}, planos: [] }
}

const chavesTexto = new Set<string>(Object.keys(ptBR))

const planoConfigSchema = z.object({
  id: z.enum(IDS_PLANO_CONFIG),
  nome: z.string(),
  preco: z.string(),
  dica: z.string(),
  itens: z.string(),
})

/**
 * Contrato da API de configuração: textos só com chaves do dicionário e
 * planos só com os quatro ids editáveis. O conteúdo em si é texto puro —
 * escape é responsabilidade da UI.
 */
export const configuracaoSchema = z
  .object({
    versao: z.number().int(),
    textos: z.record(z.string(), z.string()),
    planos: z.array(planoConfigSchema),
  })
  .superRefine((valor, ctx) => {
    for (const chave of Object.keys(valor.textos)) {
      if (!chavesTexto.has(chave)) {
        ctx.addIssue({
          code: 'custom',
          path: ['textos', chave],
          message: `Chave de texto desconhecida: ${chave}`,
        })
      }
    }
    // Redundante com z.enum, mas explicita o contrato dos ids no superRefine.
    for (const plano of valor.planos) {
      if (!IDS_PLANO_CONFIG.includes(plano.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['planos', plano.id],
          message: `Id de plano desconhecido: ${plano.id}`,
        })
      }
    }
  })
