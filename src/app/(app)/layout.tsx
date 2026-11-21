import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { exigirAcesso } from '@/lib/auth/acesso'

/**
 * Gate server-side do grupo protegido. O middleware só checa a presença do
 * cookie no Edge; aqui a sessão é validada no banco e o e-mail conferido na
 * allowlist. Qualquer falha leva à tela neutra, sem pista sobre o motivo.
 */
export default async function LayoutApp({ children }: { children: ReactNode }) {
  const cabecalhos = await headers()
  const cookie = cabecalhos.get('cookie')
  const req = new Request('http://localhost', cookie ? { headers: { cookie } } : undefined)

  if (!(await exigirAcesso(req))) redirect('/em-desenvolvimento')

  return <>{children}</>
}
