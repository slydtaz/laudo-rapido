'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Tipo = 'sucesso' | 'erro' | 'info'
type Aviso = { id: number; mensagem: string; tipo: Tipo }

type Valor = {
  avisar: (mensagem: string, tipo?: Tipo) => void
}

const Contexto = createContext<Valor | null>(null)
const DURACAO = 4000

export default function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const proximoId = useRef(0)
  const temporizadores = useRef<number[]>([])

  useEffect(
    () => () => {
      temporizadores.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  const avisar = useCallback((mensagem: string, tipo: Tipo = 'sucesso') => {
    const id = ++proximoId.current
    setAvisos((atual) => [...atual, { id, mensagem, tipo }])
    const temporizador = window.setTimeout(() => {
      setAvisos((atual) => atual.filter((aviso) => aviso.id !== id))
    }, DURACAO)
    temporizadores.current.push(temporizador)
  }, [])

  return (
    <Contexto.Provider value={{ avisar }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {avisos.map((aviso) => (
          <div
            key={aviso.id}
            role={aviso.tipo === 'erro' ? 'alert' : 'status'}
            className="pop pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-fg shadow-lg"
            style={{ boxShadow: 'var(--shadow-lift)' }}
          >
            <span
              aria-hidden="true"
              className={
                aviso.tipo === 'erro'
                  ? 'mt-0.5 font-bold text-danger'
                  : aviso.tipo === 'info'
                    ? 'mt-0.5 font-bold text-accent'
                    : 'mt-0.5 font-bold text-success'
              }
            >
              {aviso.tipo === 'erro' ? '!' : aviso.tipo === 'info' ? 'i' : '✓'}
            </span>
            <span className="flex-1 leading-snug">{aviso.mensagem}</span>
          </div>
        ))}
      </div>
    </Contexto.Provider>
  )
}

export function useToast(): Valor {
  const valor = useContext(Contexto)
  if (!valor) {
    throw new Error('useToast precisa estar dentro de ToastProvider')
  }
  return valor
}
