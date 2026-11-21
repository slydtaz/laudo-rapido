'use client'

import Skeleton from '@/components/Skeleton'
import { useT } from '@/lib/i18n/useT'

export default function CarregandoEntrega() {
  const t = useT()

  return (
    <main className="space-y-6">
      <div className="card p-6 sm:p-8">
        <div className="skeleton mb-6 h-3 w-28" />
        <Skeleton linhas={2} bloco={false} label={t('carregando')} />
      </div>
      <div className="card p-3 sm:p-4">
        <div className="skeleton h-[60vh] min-h-80 w-full" />
      </div>
    </main>
  )
}
