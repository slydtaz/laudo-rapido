/*
 * Service worker do LaudoRápido — cache SOMENTE do app shell e de assets
 * estáticos. Nunca cacheia /api/*, /o/*, /login nem qualquer resposta que
 * contenha dados de tenant ou link opaco: um cache stale ali seria fuga de
 * segurança (vazamento entre contas no mesmo aparelho).
 */

// v2: purga o cache v1, que podia conter HTML de /login gravado sob
// /visitas/nova antes da correção do redirect.
const VERSAO = 'laudo-rapido-v2'
const CACHE_SHELL = `${VERSAO}-shell`
const SHELL = ['/', '/visitas/nova', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

// Páginas do app shell (HTML público, sem dados de tenant). O restante —
// notadamente /login — nunca é gravado no cache.
function eShell(pathname) {
  return pathname === '/' || pathname === '/visitas/nova'
}

function eAssetEstatico(pathname) {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.webmanifest')
  )
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves.filter((chave) => chave !== CACHE_SHELL).map((chave) => caches.delete(chave)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const requisicao = event.request
  if (requisicao.method !== 'GET') {
    return
  }

  const url = new URL(requisicao.url)
  if (url.origin !== self.location.origin) {
    return
  }
  // Regra de ouro: dados e links opacos nunca entram no cache.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/o/') ||
    url.pathname === '/login'
  ) {
    return
  }

  if (requisicao.mode === 'navigate') {
    event.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          // Um redirect (ex.: /visitas/nova -> /login quando a sessão expirou)
          // NÃO pode ser gravado sob a URL original: gravaríamos a página de
          // login como se fosse o app shell.
          if (resposta.ok && !resposta.redirected && eShell(url.pathname)) {
            const copia = resposta.clone()
            caches.open(CACHE_SHELL).then((cache) => cache.put(url.pathname, copia))
          }
          return resposta
        })
        .catch(async () => {
          if (!eShell(url.pathname)) {
            return Response.error()
          }
          // Fallback restrito ao app shell conhecido. Nunca serve /login,
          // /api/* ou /o/* a partir do cache.
          return (await caches.match(url.pathname)) ?? (await caches.match('/')) ?? Response.error()
        }),
    )
    return
  }

  if (eAssetEstatico(url.pathname)) {
    event.respondWith(
      caches.match(requisicao).then(
        (cacheado) =>
          cacheado ??
          fetch(requisicao).then((resposta) => {
            if (resposta.ok) {
              const copia = resposta.clone()
              caches.open(CACHE_SHELL).then((cache) => cache.put(requisicao, copia))
            }
            return resposta
          }),
      ),
    )
  }
})
