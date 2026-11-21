import { lerCookieOAuth } from '@/lib/auth/cookie'
import { modoDemo, perfilDemo } from '@/lib/auth/google'

function escapar(valor: string): string {
  return valor.replace(
    /[&<>"']/g,
    (caractere) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]!,
  )
}

/** Consentimento simulado, claramente rotulado. Nunca disponível em produção. */
export function GET(req: Request) {
  if (!modoDemo()) {
    return new Response(null, { status: 404 })
  }
  const fluxo = lerCookieOAuth(req)
  if (!fluxo) {
    return new Response('Fluxo OAuth expirado. Comece novamente.', { status: 400 })
  }
  const perfil = perfilDemo()
  const state = escapar(fluxo.state)

  return new Response(
    `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google (demo)</title></head>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:3rem auto;padding:1.5rem;line-height:1.5">
  <p style="background:#fff3cd;padding:.75rem 1rem;border-radius:.75rem;font-weight:600">Modo demo — não é o Google. Nenhuma credencial real é usada.</p>
  <h1>Continuar como ${escapar(perfil.nome)}</h1>
  <p>Esta identidade simulada usa <strong>${escapar(perfil.email)}</strong> e serve apenas para testar o fluxo local.</p>
  <form method="get" action="/api/v1/auth/google/callback">
    <input type="hidden" name="code" value="demo-code">
    <input type="hidden" name="state" value="${state}">
    <button type="submit" style="min-height:44px;padding:.75rem 1.25rem;cursor:pointer">Continuar no modo demo</button>
  </form>
  <p><a href="/login">Voltar ao login</a></p>
</body>
</html>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  )
}
