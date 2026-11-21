import { z } from 'zod'

import { acessoOuErro } from '@/lib/auth/acesso'
import { db } from '@/lib/db/client'
import { assinaturas } from '@/lib/db/schema'
import { extrairDataUrl, normalizarAssinatura, salvarAssinatura } from '@/lib/storage/client'
import { visitaDoTenant } from '@/lib/visita/acesso'

const assinaturaSchema = z.object({
  dataUrl: z.string().min(1),
})

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta
  const { acesso } = resultado

  const { id } = await params
  if (!(await visitaDoTenant(id, acesso.empresaId))) {
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
