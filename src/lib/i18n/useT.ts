'use client'

import { useCallback } from 'react'

import { usePreferencias } from '@/components/ProvedorPreferencias'

import { IDIOMAS_TEXTOS, ptBR, type ChaveTexto } from './dicionario'

export type Tradutor = (
  chave: ChaveTexto,
  valores?: Record<string, string | number>,
) => string

/** Lê o idioma do provedor. Trocar de idioma muda os textos sem recarregar. */
export function useT(): Tradutor {
  const { preferencias } = usePreferencias()

  return useCallback(
    (chave, valores) => {
      const texto = IDIOMAS_TEXTOS[preferencias.idioma][chave] ?? ptBR[chave]
      if (!valores) return texto
      return texto.replace(/\{(\w+)\}/g, (_, nome: string) =>
        String(valores[nome] ?? `{${nome}}`),
      )
    },
    [preferencias.idioma],
  )
}
