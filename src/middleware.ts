import { NextResponse, type NextRequest } from 'next/server'

/**
 * Únicas rotas acessíveis sem sessão: login (senha e Google), recuperação,
 * verificação, health, páginas legais (/privacidade, /termos, /cookies) e as
 * telas de bloqueio. `/registro`, `/planos`, `/o/:token` e todo o resto ficam
 * protegidos por padrão. A allowlist não roda aqui: o Edge só decide se há
 * cookie; a validação real acontece nos layouts e nas rotas.
 */
export const ROTAS_PUBLICAS = [
  '/login',
  '/em-desenvolvimento',
  '/offline',
  '/esqueci-senha',
  '/redefinir-senha',
  '/verificar-email',
  '/api/health',
  '/api/v1/auth/login',
  '/api/v1/auth/verificar',
  '/api/v1/auth/verificar/reenviar',
  '/api/v1/auth/senha/esqueci',
  '/api/v1/auth/senha/redefinir',
  '/api/v1/auth/google',
  '/api/v1/auth/google/callback',
  '/api/v1/auth/logout',
  '/privacidade',
  '/termos',
  '/cookies',
]

/** Espelha ERRO_ACESSO sem importar módulos de banco para o runtime do Edge. */
const ERRO_SEM_ACESSO = { erro: 'Aplicativo em desenvolvimento.' }

/**
 * Checagem leve, segura no Edge runtime: apenas a presença do cookie `sessao`.
 * A validação real (lookup + expiração + allowlist) é feita por `exigirAcesso`.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const publica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  )
  if (publica || req.cookies.has('sessao')) {
    return NextResponse.next()
  }

  // API não deve ser redirecionada para uma página: o cliente espera JSON.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(ERRO_SEM_ACESSO, { status: 403 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/em-desenvolvimento'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  // Fora do middleware: assets do Next e arquivos com extensão no fim.
  matcher: ['/((?!_next/static|__next/static|_next/image|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
}
