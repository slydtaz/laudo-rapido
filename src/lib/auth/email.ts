import type { TipoToken } from './tokens'

export type LinkEmail = { tipo: TipoToken; token: string; email: string }

export type ResultadoEnvio =
  | { modo: 'demo'; link: string; token: string }
  | { modo: 'webhook' }
  | { modo: 'silencioso' }

const ASSUNTOS: Record<TipoToken, string> = {
  verificar_email: 'Verifique seu e-mail',
  redefinir_senha: 'Redefinição de senha',
}

export function montarLink(tipo: TipoToken, token: string): string {
  const caminho = tipo === 'verificar_email' ? 'verificar-email' : 'redefinir-senha'
  return `/${caminho}?token=${encodeURIComponent(token)}`
}

/**
 * Entrega o link ao destinatário. Nunca registra token em log: em modo demo o
 * token volta na resposta para a tela mostrar; em produção segue dentro do link
 * enviado ao webhook, sem campo próprio.
 */
export async function enviarLink(link: LinkEmail): Promise<ResultadoEnvio> {
  const url = montarLink(link.tipo, link.token)
  const webhook = process.env.EMAIL_WEBHOOK_URL

  if (webhook) {
    try {
      const resposta = await fetch(webhook, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          para: link.email,
          assunto: ASSUNTOS[link.tipo],
          link: url,
        }),
      })
      if (resposta.ok) {
        return { modo: 'webhook' }
      }
    } catch {
      // Falha de entrega não revela se a conta existe.
    }
    return { modo: 'silencioso' }
  }

  if (process.env.NODE_ENV !== 'production') {
    return { modo: 'demo', link: url, token: link.token }
  }

  return { modo: 'silencioso' }
}
