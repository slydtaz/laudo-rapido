import { listarLinksDemo } from '@/lib/auth/email'

/** Caixa de entrada do modo demo. Nunca existe em produção. */
export function GET() {
  if (process.env.NODE_ENV === 'production') {
    return new Response(null, { status: 404 })
  }
  return Response.json({ links: listarLinksDemo() })
}
