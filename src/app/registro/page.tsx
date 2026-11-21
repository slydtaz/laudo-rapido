import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { exigirAcesso } from '@/lib/auth/acesso'

import FormularioRegistro from './FormularioRegistro'

/**
 * /registro fica na raiz conforme o plano, mas o middleware só vê a presença
 * do cookie no Edge. Aqui a sessão é validada no banco e o e-mail conferido na
 * allowlist; sem sessão ou com e-mail negado, a tela neutra — sem pista do
 * motivo. Nenhuma regra de autorização vive no cliente.
 */
export default async function PaginaRegistro() {
  const cabecalhos = await headers()
  const cookie = cabecalhos.get('cookie')
  const req = new Request(
    'http://localhost/registro',
    cookie ? { headers: { cookie } } : undefined,
  )

  if (!(await exigirAcesso(req))) redirect('/em-desenvolvimento')

  return <FormularioRegistro />
}
