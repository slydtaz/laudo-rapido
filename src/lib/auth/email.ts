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

export type LinkDemo = {
  tipo: TipoToken
  email: string
  link: string
  token: string
  emitidoEm: string
}

/**
 * Caixa de entrada do modo demo: somente em memória e somente fora de produção.
 * Não recebe e-mail como parâmetro, então não revela se uma conta existe.
 */
type GlobalComCaixa = typeof globalThis & { __laudoRapidoCaixaDemo?: LinkDemo[] }

/**
 * Cada route handler compilado pelo Next.js em dev pode carregar sua própria
 * instância deste módulo. Guardar a caixa no `globalThis` mantém um único
 * buffer por processo, então um link emitido por uma rota aparece na listagem.
 */
function caixaDemo(): LinkDemo[] {
  const global = globalThis as GlobalComCaixa
  global.__laudoRapidoCaixaDemo ??= []
  return global.__laudoRapidoCaixaDemo
}

export function listarLinksDemo(): LinkDemo[] {
  return caixaDemo().slice(-10).reverse()
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
    const caixa = caixaDemo()
    caixa.push({
      tipo: link.tipo,
      email: link.email,
      link: url,
      token: link.token,
      emitidoEm: new Date().toISOString(),
    })
    if (caixa.length > 50) {
      caixa.shift()
    }
    return { modo: 'demo', link: url, token: link.token }
  }

  return { modo: 'silencioso' }
}
