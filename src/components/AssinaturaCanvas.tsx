'use client'

import { useEffect, useRef, useState, type PointerEvent } from 'react'

import { useToast } from '@/components/ToastProvider'
import { useT } from '@/lib/i18n/useT'

type AssinaturaCanvasProps = {
  /** Recebe o PNG desenhado; `null` quando a área é limpa. */
  onAssinatura: (blob: Blob | null) => void
}

// Reserva fixa igual ao limite de normalização (1200×400): em tablets com DPR 3
// o traço é capturado em alta resolução e o servidor reduz sem ampliar.
const LARGURA = 1200
const ALTURA = 400

/**
 * Área de assinatura reutilizável. Não depende de rota nem de rede: devolve o
 * PNG como Blob para que o chamador enfileire com a visita (caminho offline).
 */
export default function AssinaturaCanvas({ onAssinatura }: AssinaturaCanvasProps) {
  const t = useT()
  const { avisar } = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const temTraco = useRef(false)
  const [podeConfirmar, setPodeConfirmar] = useState(false)
  const [capturada, setCapturada] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Ref mantém o callback mais recente sem entrar nas dependências do efeito
  // de mount: se `onAssinatura` fizesse parte delas, cada re-render (inclusive
  // o posterior a `confirmar`) apagaria a assinatura recém-capturada.
  const onAssinaturaRef = useRef(onAssinatura)
  onAssinaturaRef.current = onAssinatura

  useEffect(() => {
    // Ao montar — inclusive após a remontagem provocada pela troca de `key`
    // quando uma visita é salva — o canvas está em branco. Notifica o pai para
    // que seu estado (`assinatura`) não divirja do estado interno do componente.
    onAssinaturaRef.current(null)
  }, [])

  function ponto(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas) {
      return { x: 0, y: 0 }
    }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function iniciarTraco(event: PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) {
      return
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    desenhando.current = true
    temTraco.current = true
    setPodeConfirmar(true)
    setCapturada(false)
    setErro(null)
    ctx.strokeStyle = '#111827'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const { x, y } = ponto(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function continuarTraco(event: PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) {
      return
    }
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) {
      return
    }
    const { x, y } = ponto(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function finalizarTraco() {
    desenhando.current = false
  }

  function limpar() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) {
      return
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    temTraco.current = false
    setPodeConfirmar(false)
    setCapturada(false)
    setErro(null)
    onAssinatura(null)
  }

  function confirmar() {
    const canvas = canvasRef.current
    if (!canvas || !temTraco.current) {
      return
    }
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErro(t('visitaErroAssinatura'))
          return
        }
        setCapturada(true)
        setErro(null)
        onAssinatura(blob)
        avisar(t('visitaConfirmada'))
      },
      'image/png',
    )
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{t('visitaAssinatura')}</p>
        <p className="text-xs leading-relaxed text-muted">{t('visitaAssinaturaDica')}</p>
      </div>
      <div
        className="overflow-hidden rounded-xl border border-line bg-surface transition-colors focus-within:border-brand"
        style={{ boxShadow: 'var(--shadow)' }}
      >
        <canvas
          ref={canvasRef}
          width={LARGURA}
          height={ALTURA}
          aria-label={t('visitaAssinatura')}
          onPointerDown={iniciarTraco}
          onPointerMove={continuarTraco}
          onPointerUp={finalizarTraco}
          onPointerCancel={finalizarTraco}
          onLostPointerCapture={finalizarTraco}
          className="block h-auto w-full cursor-crosshair touch-none"
        />
      </div>
      {erro && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={limpar} className="btn btn-ghost">
          {t('visitaLimpar')}
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={!podeConfirmar}
          className="btn btn-primary"
        >
          {t('visitaConfirmar')}
        </button>
        {capturada && (
          <span className="chip chip-ok pop" role="status">
            ✓ {t('visitaConfirmada')}
          </span>
        )}
      </div>
    </section>
  )
}
