'use client'

import Link from 'next/link'

import { useT } from '@/lib/i18n/useT'

export default function NaoEncontrado() {
  const t = useT()

  return (
    <main className="flex min-h-[80dvh] items-center justify-center">
      <section className="card reveal w-full max-w-lg overflow-hidden p-8 text-center sm:p-12">
        <p
          aria-hidden="true"
          className="font-display text-7xl font-semibold tracking-tighter text-brand sm:text-8xl"
        >
          404
        </p>
        <div className="mx-auto my-6 h-px w-16 bg-line" />
        <h1 className="reveal-2">{t('erro404Titulo')}</h1>
        <p className="reveal-3 mx-auto mt-3 max-w-sm text-muted">{t('erro404Texto')}</p>
        <Link href="/" className="btn btn-primary reveal-4 mt-8">
          {t('erro404Acao')}
        </Link>
      </section>
    </main>
  )
}
