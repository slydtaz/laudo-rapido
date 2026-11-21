import { z } from 'zod'

import { trocarSenha } from '@/lib/auth/conta'
import { extrairTokenCookie, lerSessao } from '@/lib/auth/session'

const esquema = z.object({
  senhaAtual: z.string().nullable().optional(),
  senhaNova: z.string().min(8),
})

export async function POST(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json({ erro: 'Sessão inválida ou expirada.' }, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }
  const dados = esquema.safeParse(corpo)
  if (!dados.success) {
    return Response.json(
      { erro: 'Informe a senha atual (se houver) e uma nova senha de pelo menos 8 caracteres.' },
      { status: 400 },
    )
  }

  const resultado = await trocarSenha(
    sessao.usuarioId,
    dados.data.senhaAtual ?? null,
    dados.data.senhaNova,
    extrairTokenCookie(req),
  )
  if (!resultado.ok) {
    return Response.json({ erro: resultado.erro }, { status: 400 })
  }
  return Response.json({ ok: true })
}
