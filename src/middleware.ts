import { NextResponse, type NextRequest } from 'next/server'

/**
 * Rotas acessíveis sem sessão. `/` é a landing atual; `/login` será criada
 * junto com a tela de login; a API de login e o health check também precisam
 * responder sem cookie. Todo o resto é protegido por padrão.
 */
const ROTAS_PUBLICAS = ['/', '/login', '/api/v1/auth/login', '/api/health', '/o']

/**
 * Checagem leve, segura no Edge runtime: apenas a presença do cookie `sessao`.
 * A validação real (lookup + expiração) é feita por `lerSessao` nas rotas e
 * páginas protegidas — aqui não se importa `db` nem `session.ts`.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const publica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  )
  if (publica || req.cookies.has('sessao')) {
    return NextResponse.next()
  }

  // Rotas de API não devem ser redirecionadas para uma página de login:
  // o cliente precisa do 401 JSON para tratar a sessão expirada.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ erro: 'Sessão inválida ou expirada.' }, { status: 401 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  // Fora do middleware: assets do Next e arquivos estáticos (extensão no fim).
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
}
