import { eq } from 'drizzle-orm'

import { lerSessao } from '@/lib/auth/session'
import { db } from '@/lib/db/client'
import { assinaturas, empresas, fotos, visitas } from '@/lib/db/schema'
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

  const [fotosDaVisita, [assinatura], [empresa]] = await Promise.all([
    db.select().from(fotos).where(eq(fotos.visitaId, id)),
    db.select().from(assinaturas).where(eq(assinaturas.visitaId, id)).limit(1),
    db
      .select({ nome: empresas.nome })
      .from(empresas)
      .where(eq(empresas.id, sessao.empresaId))
      .limit(1),
  ])

  const bytes = await gerarPdf({
    ...visita,
    fotos: fotosDaVisita,
    assinatura: assinatura ?? null,
    // Sem linha na empresa (somente neste tenant), o gerador usa o fallback.
    nomePrestador: empresa?.nome,
  })

  return new Response(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
    },
  })
}
