'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import {
  PREFERENCIAS_PADRAO,
  aplicarPreferencias,
  lerPreferencias,
  salvarPreferencias,
  type Preferencias,
} from '@/lib/config/preferencias'

type Valor = {
  preferencias: Preferencias
  atualizar: (parcial: Partial<Preferencias>) => void
}

const Contexto = createContext<Valor | null>(null)

export default function ProvedorPreferencias({ children }: { children: ReactNode }) {
  const [preferencias, setPreferencias] = useState<Preferencias>(PREFERENCIAS_PADRAO)
  const [prefereEscuro, setPrefereEscuro] = useState(false)
  const [carregado, setCarregado] = useState(false)

  useEffect(() => {
    setPreferencias(lerPreferencias())
    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    setPrefereEscuro(consulta.matches)
    const aoMudar = (evento: MediaQueryListEvent) => setPrefereEscuro(evento.matches)
    consulta.addEventListener('change', aoMudar)
    setCarregado(true)
    return () => consulta.removeEventListener('change', aoMudar)
  }, [])

  useEffect(() => {
    aplicarPreferencias(preferencias, prefereEscuro)
    if (carregado) salvarPreferencias(preferencias)
  }, [preferencias, prefereEscuro, carregado])

  const atualizar = useCallback((parcial: Partial<Preferencias>) => {
    setPreferencias((atual) => ({ ...atual, ...parcial }))
  }, [])

  const valor = useMemo<Valor>(
    () => ({ preferencias, atualizar }),
    [preferencias, atualizar],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function usePreferencias(): Valor {
  const valor = useContext(Contexto)
  if (!valor) {
    throw new Error('usePreferencias precisa estar dentro de ProvedorPreferencias')
  }
  return valor
}
