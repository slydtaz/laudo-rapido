/*
 * Service worker do LaudoRápido — v4.
 *
 * Cache SOMENTE de assets estáticos e da página /offline. Nenhuma página HTML
 * de navegação entra no cache: com o gate de acesso no servidor, gravar HTML
 * poderia servir uma tela de outra conta (ou de link opaco) depois de expirar
 * a sessão. Nunca cacheia /api/*, /o/*, /login nem dados de tenant.
 * O IndexedDB das visitas nunca é apagado aqui.
 */

// v4: remove as páginas do app shell do cache. A purga abaixo apaga v2 e v3.
const VERSAO = 'laudo-rapido-v4'
const CACHE_SHELL = `${VERSAO}-shell`
const SHELL = ['/offline', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png']

// Única página HTML com fallback offline permitido.
function eShell(pathname) {
  return pathname === '/offline'
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
          chaves
            .filter((chave) => chave.startsWith('laudo-rapido-') && chave !== CACHE_SHELL)
            .map((chave) => caches.delete(chave)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

// O cliente pede a ativação do worker em waiting quando o usuário confirma.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    event.waitUntil(Promise.resolve(self.skipWaiting()))
  }
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
    // Navegação nunca é gravada: nenhum HTML de página vai para o cache.
    // O único fallback offline é a própria página /offline, pré-cacheada.
    event.respondWith(
      fetch(requisicao).catch(async () => {
        if (!eShell(url.pathname)) {
          return Response.error()
        }
        return (await caches.match('/offline')) ?? Response.error()
      }),
    )
    return
  }

  if (eAssetEstatico(url.pathname)) {
    // Rede primeiro: o cache existe só como fallback offline. Servir um chunk
    // antigo com um runtime novo gera o erro "reading 'call'" na hidratação.
    event.respondWith(
      fetch(requisicao)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone()
            caches.open(CACHE_SHELL).then((cache) => cache.put(requisicao, copia))
          }
          return resposta
        })
        .catch(async () => (await caches.match(requisicao)) ?? Response.error()),
    )
  }
})
