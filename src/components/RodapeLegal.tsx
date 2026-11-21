'use client'

import Link from 'next/link'

import { useT } from '@/lib/i18n/useT'

/** Rodapé exibido em todas as páginas, dentro do provedor de preferências. */
export default function RodapeLegal() {
  const t = useT()

  return (
    <footer className="border-t border-line px-5 py-6 text-center text-xs leading-relaxed text-muted">
      <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link href="/privacidade" className="link inline-flex min-h-11 items-center">
          {t('legalRodapePrivacidade')}
        </Link>
        <Link href="/termos" className="link inline-flex min-h-11 items-center">
          {t('legalRodapeTermos')}
        </Link>
        <Link href="/cookies" className="link inline-flex min-h-11 items-center">
          {t('legalRodapeCookies')}
        </Link>
      </div>
      <p className="mt-2">{t('legalPrevalencia')}</p>
    </footer>
  )
}
