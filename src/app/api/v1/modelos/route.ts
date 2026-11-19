import { eq } from 'drizzle-orm'
import { z } from 'zod'

import { lerSessao } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { modelosVisita } from '@/lib/db/schema'

const ERRO_SESSAO = { erro: 'Sessão inválida ou expirada.' }

const criarModeloSchema = z.object({
  nome: z.string().min(1),
  campos: z.array(z.record(z.string(), z.unknown())),
})

export async function GET(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }

  const modelos = await db
    .select()
    .from(modelosVisita)
    .where(eq(modelosVisita.empresaId, sessao.empresaId))
  return Response.json({ modelos })
}

export async function POST(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = criarModeloSchema.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ erro: 'Dados do modelo inválidos.' }, { status: 400 })
  }

  // RF-08: o tenant vem da sessão; qualquer empresaId no corpo é ignorado.
  const [modelo] = await db
    .insert(modelosVisita)
    .values({
      empresaId: sessao.empresaId,
      nome: dados.data.nome,
      campos: dados.data.campos,
    })
    .returning()

  return Response.json({ modelo }, { status: 201 })
}
