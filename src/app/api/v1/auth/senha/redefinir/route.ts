import { z } from 'zod'

import { redefinirSenha } from '@/lib/auth/conta'

const esquema = z.object({
  token: z.string().min(1),
  senha: z.string().min(8),
})

export async function POST(req: Request) {
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ ok: false, erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = esquema.safeParse(corpo)
  if (!dados.success) {
    return Response.json(
      { ok: false, erro: 'Informe um link válido e uma senha de pelo menos 8 caracteres.' },
      { status: 400 },
    )
  }

  const resultado = await redefinirSenha(dados.data.token, dados.data.senha)
  if (!resultado.ok) {
    return Response.json({ ok: false, erro: resultado.erro }, { status: 400 })
  }
  return Response.json({ ok: true })
}
