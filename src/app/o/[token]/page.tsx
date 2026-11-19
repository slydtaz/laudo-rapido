import { notFound } from 'next/navigation'

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

  const bytes = await gerarPdf(visita)
  const pdf = `data:application/pdf;base64,${Buffer.from(bytes).toString('base64')}`

  return (
    <main>
      <h1>Relatório de Visita</h1>
      <p>Laudo de {String(visita.dados.cliente ?? 'cliente não informado')}.</p>
      <iframe src={pdf} title="Laudo de visita" width="100%" height="800" />
      <p>
        <a href={pdf} download={`laudo-${visita.token ?? visita.id}.pdf`}>
          Baixar PDF
        </a>
      </p>
    </main>
  )
}
