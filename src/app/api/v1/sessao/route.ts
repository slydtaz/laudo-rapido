import { acessoOuErro } from '@/lib/auth/acesso'

/**
 * Devolve SOMENTE o tenant da sessão atual. O cliente usa este id para
 * particionar o storage local (IndexedDB) em aparelhos compartilhados; nenhum
 * e-mail, id de usuário ou token é exposto. O `empresaId` continua sendo
 * derivado da sessão no servidor — nunca recebido do cliente.
 */
export async function GET(req: Request) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta
  const { acesso } = resultado

  return Response.json({ empresaId: acesso.empresaId })
}
