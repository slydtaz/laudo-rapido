import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { definirCookieSessao } from '@/lib/auth/cookie'
import { verificarSenha } from '@/lib/auth/password'
import {
  MENSAGEM_BLOQUEIO,
  chaveTentativa,
  ipDaRequisicao,
  registrarTentativa,
} from '@/lib/auth/rate-limit'
import { criarSessao } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { usuarios } from '@/lib/db/schema'

const esquemaLogin = z.object({
  email: z.email(),
  senha: z.string().min(1),
})

export async function POST(req: Request) {
  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = esquemaLogin.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ erro: 'E-mail ou senha inválidos.' }, { status: 400 })
  }

  // Limite antes da verificação Argon2: barras também o abuso de CPU.
  const { bloqueado } = await registrarTentativa(
    chaveTentativa(ipDaRequisicao(req), dados.data.email),
  )
  if (bloqueado) {
    return Response.json({ erro: MENSAGEM_BLOQUEIO }, { status: 429 })
  }

  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(eq(usuarios.email, dados.data.email))
    .limit(1)

  // Resposta genérica: não revela se o e-mail existe.
  if (!usuario?.senhaHash || !(await verificarSenha(dados.data.senha, usuario.senhaHash))) {
    return Response.json({ erro: 'E-mail ou senha incorretos.' }, { status: 401 })
  }

  const token = await criarSessao(usuario.id, usuario.empresaId)

  const resposta = Response.json({ ok: true })
  resposta.headers.append('Set-Cookie', definirCookieSessao(token))
  return resposta
}
