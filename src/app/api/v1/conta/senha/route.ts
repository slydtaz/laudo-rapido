import { z } from 'zod'

import { acessoOuErro } from '@/lib/auth/acesso'
import { trocarSenha } from '@/lib/auth/conta'
import { extrairTokenCookie } from '@/lib/auth/session'

const esquema = z.object({
  senhaAtual: z.string().nullable().optional(),
  senhaNova: z.string().min(8),
})

export async function POST(req: Request) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta
  const { acesso } = resultado

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

  const troca = await trocarSenha(
    acesso.usuarioId,
    dados.data.senhaAtual ?? null,
    dados.data.senhaNova,
    extrairTokenCookie(req),
  )
  if (!troca.ok) {
    return Response.json({ erro: troca.erro }, { status: 400 })
  }
  return Response.json({ ok: true })
}
