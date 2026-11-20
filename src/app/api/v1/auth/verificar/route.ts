import { z } from 'zod'

import { verificarEmail } from '@/lib/auth/conta'

const esquema = z.object({ token: z.string().min(1) })

export async function POST(req: Request) {
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ ok: false, erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = esquema.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ ok: false, erro: 'Link inválido ou expirado.' }, { status: 400 })
  }

  const resultado = await verificarEmail(dados.data.token)
  if (!resultado.ok) {
    return Response.json({ ok: false, erro: resultado.erro }, { status: 400 })
  }
  return Response.json({ ok: true })
}
