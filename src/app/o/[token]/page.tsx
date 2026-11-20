import { notFound } from 'next/navigation'

import EntregaPublica from '@/components/EntregaPublica'
import { gerarPdf } from '@/lib/pdf/laudo'
import { buscarVisitaPublica } from '@/lib/visita/publico'

/**
 * Link público de entrega: o token opaco é a única credencial. O mesmo PDF
 * gerado para o viewer é oferecido no botão de download.
 */
export default async function PaginaEntrega({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const visita = await buscarVisitaPublica(token)
  if (!visita) {
    notFound()
  }

  const bytes = await gerarPdf({ ...visita, nomePrestador: visita.nomePrestador ?? undefined })
  const pdf = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`
  const nomeArquivo = `laudo-${visita.token ?? visita.id}.pdf`
  const cliente = String(visita.dados.cliente ?? '')

  return <EntregaPublica cliente={cliente} pdf={pdf} nomeArquivo={nomeArquivo} />
}
