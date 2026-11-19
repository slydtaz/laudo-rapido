'use client'

import { useRef, useState, type PointerEvent } from 'react'

type AssinaturaCanvasProps = {
  visitaId: string
  onSalva?: (url: string) => void
}

// Reserva fixa igual ao limite de normalização (1200×400): em tablets com DPR 3
// o traço é capturado em alta resolução e o servidor reduz sem ampliar.
const LARGURA = 1200
const ALTURA = 400

export default function AssinaturaCanvas({ visitaId, onSalva }: AssinaturaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const desenhando = useRef(false)
  const [salvando, setSalvando] = useState(false)
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
    setErro(null)
  }

  async function salvar() {
    const canvas = canvasRef.current
    if (!canvas) {
      return
    }
    setSalvando(true)
    setErro(null)
    try {
      const resposta = await fetch(`/api/v1/visitas/${visitaId}/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: canvas.toDataURL('image/png') }),
      })
      if (!resposta.ok) {
        const falha = (await resposta.json().catch(() => ({}))) as { erro?: string }
        throw new Error(falha.erro ?? 'Não foi possível salvar a assinatura.')
      }
      const corpo = (await resposta.json()) as { assinatura: { url: string } }
      onSalva?.(corpo.assinatura.url)
    } catch (erroEnvio) {
      setErro(
        erroEnvio instanceof Error
          ? erroEnvio.message
          : 'Não foi possível salvar a assinatura.',
      )
    } finally {
      setSalvando(false)
    }
  }

  return (
    <section>
      <p>Assinatura do cliente</p>
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
        <p role="alert" style={{ color: '#b00020' }}>
          {erro}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={limpar} disabled={salvando}>
          Limpar
        </button>
        <button type="button" onClick={salvar} disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar assinatura'}
        </button>
      </div>
    </section>
  )
}
