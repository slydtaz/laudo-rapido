import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { lerSessao } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { assinaturas, visitas } from '@/lib/db/schema'
import { extrairDataUrl, normalizarAssinatura, salvarAssinatura } from '@/lib/storage/client'

const ERRO_SESSAO = { erro: 'Sessão inválida ou expirada.' }

const assinaturaSchema = z.object({
  dataUrl: z.string().min(1),
})

/** RF-08: a visita só é visível ao tenant da sessão; empresaId nunca vem do corpo. */
async function visitaDoTenant(id: string, empresaId: string) {
  if (!z.uuid().safeParse(id).success) {
    return null
  }
  const [visita] = await db
    .select({ id: visitas.id })
    .from(visitas)
    .where(and(eq(visitas.id, id), eq(visitas.empresaId, empresaId)))
    .limit(1)
  return visita ?? null
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }

  const { id } = await params
  if (!(await visitaDoTenant(id, sessao.empresaId))) {
    return Response.json({ erro: 'Visita não encontrada.' }, { status: 404 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = assinaturaSchema.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ erro: 'Dados da assinatura inválidos.' }, { status: 400 })
  }

  try {
    extrairDataUrl(dados.data.dataUrl)
  } catch {
    return Response.json({ erro: 'Imagem inválida.' }, { status: 400 })
  }

  let png: Buffer
  let url: string
  try {
    png = await normalizarAssinatura(dados.data.dataUrl)
    url = await salvarAssinatura(id, png)
  } catch {
    return Response.json(
      { erro: 'Falha ao salvar a assinatura.' },
      { status: 502 },
    )
  }

  await db
    .insert(assinaturas)
    .values({ visitaId: id, url })
    .onConflictDoUpdate({ target: assinaturas.visitaId, set: { url } })

  return Response.json({ assinatura: { url } }, { status: 201 })
}
