'use client'

import { useRef, useState, type PointerEvent } from 'react'

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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const temTraco = useRef(false)
  const [podeConfirmar, setPodeConfirmar] = useState(false)
  const [capturada, setCapturada] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

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
          setErro('Não foi possível capturar a assinatura. Tente novamente.')
          return
        }
        setCapturada(true)
        setErro(null)
        onAssinatura(blob)
      },
      'image/png',
    )
  }

  return (
    <section className="space-y-2">
      <p className="font-medium">Assinatura do cliente</p>
      <canvas
        ref={canvasRef}
        width={LARGURA}
        height={ALTURA}
        aria-label="Área para assinatura do cliente"
        onPointerDown={iniciarTraco}
        onPointerMove={continuarTraco}
        onPointerUp={finalizarTraco}
        onPointerCancel={finalizarTraco}
        onLostPointerCapture={finalizarTraco}
        style={{
          width: '100%',
          height: 'auto',
          background: '#ffffff',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          cursor: 'crosshair',
          touchAction: 'none',
        }}
      />
      {erro && (
        <p role="alert" className="text-red-700">
          {erro}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={limpar}
          className="rounded border border-slate-300 px-3 py-2"
        >
          Limpar
        </button>
        <button
          type="button"
          onClick={confirmar}
          disabled={!podeConfirmar}
          className="rounded bg-teal-700 px-3 py-2 text-white disabled:opacity-50"
        >
          Confirmar assinatura
        </button>
        {capturada && <span className="self-center text-sm text-teal-800">Assinatura capturada.</span>}
      </div>
    </section>
  )
}
