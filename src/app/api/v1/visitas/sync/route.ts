import { z } from 'zod'

import { lerSessao } from '@/lib/auth/session'
import type { VisitaLocal } from '@/lib/offline/queue'
import { ERRO_SESSAO } from '@/lib/visita/acesso'
import { criarVisitaSchema } from '@/lib/visita/service'
import { sincronizarLote } from '@/lib/visita/sync'

const itemMultipartSchema = criarVisitaSchema.extend({
  // Cada blob viaja em um campo do FormData; estes descritores o referenciam.
  fotos: z
    .array(z.object({ campo: z.string().min(1), capturadoEm: z.coerce.date() }))
    .default([]),
  assinaturaCampo: z.string().optional(),
})

const loteMultipartSchema = z.array(itemMultipartSchema)

function blobDoCampo(form: FormData, campo: string): Blob {
  const valor = form.get(campo)
  if (!valor || typeof valor === 'string') {
    throw new Error(`Arquivo ausente no campo ${campo}.`)
  }
  return valor as Blob
}

async function itensDoJson(req: Request): Promise<VisitaLocal[]> {
  const lote = z.array(criarVisitaSchema).parse(await req.json())
  return lote.map((item) => ({ ...item, fotos: [] }))
}

async function itensDoMultipart(req: Request): Promise<VisitaLocal[]> {
  const form = await req.formData()
  const campoLote = form.get('lote')
  if (typeof campoLote !== 'string') {
    throw new Error('Campo "lote" ausente.')
  }

  const lote = loteMultipartSchema.parse(JSON.parse(campoLote))
  return lote.map((item) => ({
    clientId: item.clientId,
    modeloId: item.modeloId,
    dados: item.dados,
    capturadoEm: item.capturadoEm,
    fotos: item.fotos.map((foto) => ({
      blob: blobDoCampo(form, foto.campo),
      capturadoEm: foto.capturadoEm,
    })),
    assinatura: item.assinaturaCampo
      ? blobDoCampo(form, item.assinaturaCampo)
      : undefined,
  }))
}

export async function POST(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }

  let itens: VisitaLocal[]
  try {
    itens = (req.headers.get('content-type') ?? '').includes('multipart/form-data')
      ? await itensDoMultipart(req)
      : await itensDoJson(req)
  } catch {
    return Response.json({ erro: 'Lote de visitas inválido.' }, { status: 400 })
  }

  let resultado: { criadas: number; duplicadas: number }
  try {
    resultado = await sincronizarLote(itens, sessao.empresaId)
  } catch {
    return Response.json({ erro: 'Falha ao sincronizar o lote de visitas.' }, { status: 502 })
  }

  return Response.json(resultado)
}
