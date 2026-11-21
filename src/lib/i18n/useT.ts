'use client'

import { useCallback } from 'react'

import { useConfiguracao } from '@/components/ProvedorConfiguracao'
import { usePreferencias } from '@/components/ProvedorPreferencias'

import { textoPlanoPermitido } from '@/lib/saas/planos'

import { IDIOMAS_TEXTOS, ptBR, type ChaveTexto } from './dicionario'

export type Tradutor = (
  chave: ChaveTexto,
  valores?: Record<string, string | number>,
) => string

/** Lê o idioma do provedor. Trocar de idioma muda os textos sem recarregar. */
export function useT(): Tradutor {
  const { preferencias } = usePreferencias()
  const { configuracao } = useConfiguracao()

  return useCallback(
    (chave, valores) => {
      const base = IDIOMAS_TEXTOS[preferencias.idioma][chave] ?? ptBR[chave]
      const texto = textoPlanoPermitido(configuracao?.textos?.[chave], base)
      if (!valores) return texto
      return texto.replace(/\{(\w+)\}/g, (_, nome: string) =>
        String(valores[nome] ?? `{${nome}}`),
      )
    },
    [preferencias.idioma, configuracao],
  )
}
