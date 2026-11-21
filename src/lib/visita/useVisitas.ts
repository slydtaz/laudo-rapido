'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { VisitaHistorico } from './filtro'

export type UseVisitas = {
  visitas: VisitaHistorico[]
  carregando: boolean
  falhou: boolean
  atualizadoEm: Date | null
  recarregar: () => void
}

/** Intervalo entre atualizações em segundo plano. */
const INTERVALO_MS = 30_000

type Modo = 'inicial' | 'segundoPlano'

/**
 * Carrega o histórico e mantém a lista atualizada enquanto a aba está visível
 * e houver conexão. A lista anterior permanece na tela durante o refresh: o
 * skeleton aparece apenas na carga inicial e em `recarregar()`.
 */
export function useVisitas(): UseVisitas {
  const [visitas, setVisitas] = useState<VisitaHistorico[]>([])
  const [carregando, setCarregando] = useState(true)
  const [falhou, setFalhou] = useState(false)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const rodada = useRef<AbortController | null>(null)

  const carregar = useCallback(async (sinal: AbortSignal, modo: Modo) => {
    if (modo === 'inicial') {
      setCarregando(true)
      setFalhou(false)
    }

    try {
      const resposta = await fetch('/api/v1/visitas', { signal: sinal })
      if (!resposta.ok) throw new Error('histórico indisponível')
      // Qualquer rodada bem-sucedida recupera um erro anterior, inclusive a
      // atualização em segundo plano — sem isso a lista recuperada ficaria
      // escondida atrás do cartão de erro.
      setFalhou(false)
      const corpo = (await resposta.json()) as { visitas?: VisitaHistorico[] }
      setVisitas(Array.isArray(corpo.visitas) ? corpo.visitas : [])
      setAtualizadoEm(new Date())
    } catch (erro) {
      if ((erro as Error).name === 'AbortError' || sinal.aborted) return
      // No segundo plano a lista antiga permanece; a próxima rodada tenta de novo.
      if (modo === 'inicial') {
        setFalhou(true)
        setVisitas([])
      }
    } finally {
      if (!sinal.aborted) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    const controle = new AbortController()
    rodada.current?.abort()
    rodada.current = controle
    void carregar(controle.signal, 'inicial')

    const intervalo = setInterval(() => {
      if (document.visibilityState !== 'visible' || !navigator.onLine) return
      rodada.current?.abort()
      const proximo = new AbortController()
      rodada.current = proximo
      void carregar(proximo.signal, 'segundoPlano')
    }, INTERVALO_MS)

    return () => {
      clearInterval(intervalo)
      controle.abort()
      rodada.current?.abort()
    }
  }, [carregar, tentativa])

  const recarregar = useCallback(() => setTentativa((atual) => atual + 1), [])

  return { visitas, carregando, falhou, atualizadoEm, recarregar }
}
