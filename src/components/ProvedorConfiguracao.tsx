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

import type { Configuracao } from '@/lib/configuracao/modelo'

const CAMINHO = '/api/v1/configuracao'

type Valor = {
  configuracao: Configuracao | null
  salvar: (configuracao: Configuracao) => Promise<void>
}

const Contexto = createContext<Valor | null>(null)

/** Só aceita o formato da API: uma resposta alheia não pode virar configuração. */
function ehConfiguracao(valor: unknown): valor is Configuracao {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return false
  const objeto = valor as Record<string, unknown>
  return (
    typeof objeto.versao === 'number' &&
    typeof objeto.textos === 'object' &&
    objeto.textos !== null &&
    !Array.isArray(objeto.textos) &&
    Array.isArray(objeto.planos)
  )
}

/**
 * Busca a configuração publicada no mount e expõe a gravação via API.
 * Falha de rede, resposta inválida ou ausência do provider deixam os textos
 * exatamente como o dicionário local.
 */
export default function ProvedorConfiguracao({ children }: { children: ReactNode }) {
  const [configuracao, setConfiguracao] = useState<Configuracao | null>(null)

  useEffect(() => {
    if (typeof fetch !== 'function') return
    let ativo = true

    fetch(CAMINHO)
      .then(async (resposta) => {
        if (!resposta.ok) return null
        const dados: unknown = await resposta.json()
        return ehConfiguracao(dados) ? dados : null
      })
      .then((dados) => {
        if (ativo && dados) setConfiguracao(dados)
      })
      .catch(() => {
        // Offline ou API indisponível: o dicionário continua valendo.
      })

    return () => {
      ativo = false
    }
  }, [])

  const salvar = useCallback(async (nova: Configuracao) => {
    const resposta = await fetch(CAMINHO, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(nova),
    })
    if (!resposta.ok) throw new Error('Não foi possível salvar a configuração.')
    const dados: unknown = await resposta.json()
    setConfiguracao(ehConfiguracao(dados) ? dados : nova)
  }, [])

  const valor = useMemo<Valor>(() => ({ configuracao, salvar }), [configuracao, salvar])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

/** Fora do provider devolve null e uma gravação sem efeito. */
export function useConfiguracao(): Valor {
  return useContext(Contexto) ?? { configuracao: null, salvar: async () => {} }
}
