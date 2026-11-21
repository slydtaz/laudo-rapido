import { z } from 'zod'

import { atualizarNome, lerPerfil } from '@/lib/auth/conta'
import { lerSessao } from '@/lib/auth/session'

const esquema = z.object({
  nome: z.string().trim().min(1),
  empresa: z.string().trim().min(1),
})

export async function GET(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json({ erro: 'Sessão inválida ou expirada.' }, { status: 401 })
  }
  const perfil = await lerPerfil(sessao.usuarioId)
  if (!perfil) {
    return Response.json({ erro: 'Conta não encontrada.' }, { status: 404 })
  }
  return Response.json(perfil)
}

export async function PATCH(req: Request) {
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
    return Response.json({ erro: 'Informe nome e empresa.' }, { status: 400 })
  }

  await atualizarNome(sessao.usuarioId, dados.data.nome, dados.data.empresa)
  return Response.json({ ok: true })
}
