import { z } from 'zod'

import { lerSessao } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { fotos } from '@/lib/db/schema'
import { extrairDataUrl, MIMES_FOTO, salvarFoto } from '@/lib/storage/client'
import { ERRO_SESSAO, visitaDoTenant } from '@/lib/visita/acesso'

const fotoSchema = z.object({
  dataUrl: z.string().min(1),
  capturadoEm: z.coerce.date().optional(),
})

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

  const dados = fotoSchema.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ erro: 'Dados da foto inválidos.' }, { status: 400 })
  }

  let imagem: { mime: string; buffer: Buffer }
  try {
    imagem = extrairDataUrl(dados.data.dataUrl)
  } catch {
    return Response.json({ erro: 'Imagem inválida.' }, { status: 400 })
  }
  if (!Object.hasOwn(MIMES_FOTO, imagem.mime)) {
    return Response.json({ erro: 'Formato de imagem não suportado.' }, { status: 400 })
  }

  let url: string
  try {
    url = await salvarFoto(id, imagem.buffer, imagem.mime)
  } catch {
    return Response.json(
      { erro: 'Falha ao enviar a foto para o armazenamento.' },
      { status: 502 },
    )
  }

  const [foto] = await db
    .insert(fotos)
    .values({ visitaId: id, url, capturadoEm: dados.data.capturadoEm ?? new Date() })
    .returning()

  return Response.json(
    { foto: { id: foto.id, url, capturadoEm: foto.capturadoEm.toISOString() } },
    { status: 201 },
  )
}
