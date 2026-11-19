import { eq } from 'drizzle-orm'

import { lerSessao } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { assinaturas, fotos, visitas } from '@/lib/db/schema'
import { gerarPdf } from '@/lib/pdf/laudo'
import { ERRO_SESSAO, visitaDoTenant } from '@/lib/visita/acesso'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }

  const { id } = await params
  if (!(await visitaDoTenant(id, sessao.empresaId))) {
    return Response.json({ erro: 'Visita não encontrada.' }, { status: 404 })
  }

  const [visita] = await db.select().from(visitas).where(eq(visitas.id, id)).limit(1)
  if (!visita) {
    return Response.json({ erro: 'Visita não encontrada.' }, { status: 404 })
  }

  const [fotosDaVisita, [assinatura]] = await Promise.all([
    db.select().from(fotos).where(eq(fotos.visitaId, id)),
    db.select().from(assinaturas).where(eq(assinaturas.visitaId, id)).limit(1),
  ])

  const bytes = await gerarPdf({
    ...visita,
    fotos: fotosDaVisita,
    assinatura: assinatura ?? null,
  })

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  })
}
