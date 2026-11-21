import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import { acessoOuErro, exigirAcesso } from '@/lib/auth/acesso'

import FormularioLogin from './FormularioLogin'
import RegistradorSW from '@/components/RegistradorSW'

/**
 * /login é pública, mas não pode virar porta dos fundos: com e-mail liberado o
 * usuário já está dentro; com outro e-mail, cai na mesma tela de bloqueio das
 * rotas protegidas. Sem sessão, o formulário é renderizado.
 */
export default async function PaginaLogin() {
  const cabecalhos = await headers()
  const cookie = cabecalhos.get('cookie')
  const req = new Request(
    'http://localhost/login',
    cookie ? { headers: { cookie } } : undefined,
  )

  if (await exigirAcesso(req)) redirect('/visitas')

  // exigirAcesso devolve null tanto para "sem sessão" quanto para "e-mail
  // negado"; a variante acessoOuErro separa 401 de 403 no servidor.
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado && resultado.resposta.status === 403) {
    redirect('/em-desenvolvimento')
  }

  return (
    <>
      <RegistradorSW />
      <FormularioLogin />
    </>
  )
}
