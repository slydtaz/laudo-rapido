'use client'

import { useT } from '@/lib/i18n/useT'

type EntregaPublicaProps = {
  cliente: string
  pdf: string
  nomeArquivo: string
}

export default function EntregaPublica({ cliente, pdf, nomeArquivo }: EntregaPublicaProps) {
  const t = useT()

  return (
    <main className="space-y-6">
      <header className="card reveal flex flex-wrap items-center justify-between gap-4 p-5 sm:p-8">
        <div className="space-y-2">
          <p className="eyebrow">{t('appNome')}</p>
          <h1>{t('relatorioTitulo')}</h1>
          <p className="text-sm text-muted">
            {t('relatorioSubtitulo')}{' '}
            <strong className="text-fg">{cliente || t('relatorioClienteDesconhecido')}</strong>.
          </p>
        </div>
        <a href={pdf} download={nomeArquivo} className="btn btn-primary">
          ↓ {t('relatorioBaixar')}
        </a>
      </header>

      <section className="card overflow-hidden p-2 sm:p-4">
        <iframe
          src={pdf}
          title={t('relatorioTitulo')}
          className="h-[70vh] min-h-96 w-full rounded-lg border-0 bg-surface"
        />
      </section>
    </main>
  )
}
