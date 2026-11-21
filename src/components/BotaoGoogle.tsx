'use client'

import Link from 'next/link'

import { useT } from '@/lib/i18n/useT'

type Props = {
  rotulo?: string
}

/** Link direto para o fluxo OAuth; sem JS, o navegador ainda completa a navegação. */
export default function BotaoGoogle({ rotulo }: Props) {
  const t = useT()

  return (
    <Link
      href="/api/v1/auth/google"
      className="btn btn-soft inline-flex min-h-11 w-full items-center justify-center gap-3"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0">
        <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.36Z" />
        <path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.41l-3.23-2.5c-.9.6-2.04.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.06v2.58A10 10 0 0 0 12 22Z" />
        <path fill="#FBBC05" d="M6.39 13.92a6 6 0 0 1 0-3.84V7.5H3.06a10 10 0 0 0 0 9l3.33-2.58Z" />
        <path fill="#EA4335" d="M12 5.98c1.47 0 2.79.51 3.83 1.5l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.5l3.33 2.58C7.18 7.74 9.39 5.98 12 5.98Z" />
      </svg>
      <span>{rotulo ?? t('googleContinuar')}</span>
    </Link>
  )
}
