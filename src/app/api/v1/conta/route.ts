import { z } from 'zod'

import { acessoOuErro } from '@/lib/auth/acesso'
import { atualizarNome, lerPerfil } from '@/lib/auth/conta'

const esquema = z.object({
  nome: z.string().trim().min(1),
  empresa: z.string().trim().min(1),
})

export async function GET(req: Request) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta
  const { acesso } = resultado

  const perfil = await lerPerfil(acesso.usuarioId)
  if (!perfil) {
    return Response.json({ erro: 'Conta não encontrada.' }, { status: 404 })
  }
  return Response.json(perfil)
}

export async function PATCH(req: Request) {
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
    return Response.json({ erro: 'Informe nome e empresa.' }, { status: 400 })
  }

  await atualizarNome(acesso.usuarioId, dados.data.nome, dados.data.empresa)
  return Response.json({ ok: true })
}
