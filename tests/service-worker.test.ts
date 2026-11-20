import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

type Resposta = {
  ok: boolean
  text(): Promise<string>
  clone(): Resposta
}

class RespostaFalsa implements Resposta {
  ok: boolean

  constructor(
    private readonly conteudo: string,
    ok = true,
  ) {
    this.ok = ok
  }

  clone(): RespostaFalsa {
    return new RespostaFalsa(this.conteudo, this.ok)
  }

  async text(): Promise<string> {
    return this.conteudo
  }

  static error(): RespostaFalsa {
    return new RespostaFalsa('erro', false)
  }
}

type Evento = {
  request?: { method: string; url: string; mode?: string }
  waitUntil?: (promessa: Promise<unknown>) => void
  respondWith?: (promessa: Promise<Resposta>) => void
}

function carregarServiceWorker({
  buscar,
  cacheInicial = new Map<string, Resposta>(),
  chavesIniciais = [] as string[],
} = {}) {
  const manipuladores: Record<string, (evento: Evento) => void> = {}
  const entradas = new Map(cacheInicial)

  const cache = {
    addAll: vi.fn(async (urls: string[]) => {
      for (const url of urls) entradas.set(new URL(url, 'http://localhost:3000').href, new RespostaFalsa('shell'))
    }),
    put: vi.fn(async (requisicao: { url: string } | string, resposta: Resposta) => {
      entradas.set(String(typeof requisicao === 'string' ? requisicao : requisicao.url), resposta)
    }),
  }

  const caches = {
    open: vi.fn(async () => cache),
    match: vi.fn(async (requisicao: { url: string } | string) => {
      const chave = String(typeof requisicao === 'string' ? requisicao : requisicao.url)
      return entradas.get(chave)
    }),
    keys: vi.fn(async () => (chavesIniciais.length ? chavesIniciais : [...entradas.keys()])),
    delete: vi.fn(async (chave: string) => entradas.delete(chave)),
  }

  const self = {
    location: { origin: 'http://localhost:3000' },
    addEventListener: vi.fn((nome: string, callback: (evento: Evento) => void) => {
      manipuladores[nome] = callback
    }),
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  }

  const codigo = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8')
  new Function('self', 'caches', 'fetch', 'Response', 'URL', codigo)(
    self,
    caches,
    buscar,
    RespostaFalsa,
    URL,
  )

  return { manipuladores, entradas, cache, caches, self }
}

function requisicaoDeChunk() {
  return {
    method: 'GET',
    mode: 'no-cors' as const,
    url: 'http://localhost:3000/_next/static/chunks/app/layout.js',
  }
}

describe('service worker', () => {
  it('busca o chunk na rede mesmo quando há versão antiga no cache', async () => {
    const antigo = new RespostaFalsa('chunk antigo')
    const novo = new RespostaFalsa('chunk novo')
    const buscar = vi.fn(async () => novo)
    const { manipuladores } = carregarServiceWorker({
      buscar,
      cacheInicial: new Map([[requisicaoDeChunk().url, antigo]]),
    })

    let promessa: Promise<Resposta> | undefined
    manipuladores.fetch?.({
      request: requisicaoDeChunk(),
      respondWith: (recebida) => {
        promessa = recebida
      },
    })

    expect(buscar).toHaveBeenCalledTimes(1)
    await expect(promessa).resolves.toBe(novo)
    await expect(promessa?.then((r) => r.text())).resolves.toBe('chunk novo')
  })

  it('usa o chunk do cache apenas quando a rede falha', async () => {
    const antigo = new RespostaFalsa('chunk em cache')
    const buscar = vi.fn(async () => {
      throw new Error('offline')
    })
    const { manipuladores } = carregarServiceWorker({
      buscar,
      cacheInicial: new Map([[requisicaoDeChunk().url, antigo]]),
    })

    let promessa: Promise<Resposta> | undefined
    manipuladores.fetch?.({
      request: requisicaoDeChunk(),
      respondWith: (recebida) => {
        promessa = recebida
      },
    })

    await expect(promessa?.then((r) => r.text())).resolves.toBe('chunk em cache')
  })

  it('apaga caches de versões antigas ao ativar', async () => {
    const { manipuladores, caches } = carregarServiceWorker({
      buscar: vi.fn(async () => new RespostaFalsa('')),
      chavesIniciais: ['laudo-rapido-v2-shell', 'laudo-rapido-v3-shell', 'outro-app'],
    })

    let conclusao: Promise<unknown> | undefined
    manipuladores.activate?.({
      waitUntil: (promessa) => {
        conclusao = promessa
      },
    })
    await conclusao

    expect(caches.delete).toHaveBeenCalledWith('laudo-rapido-v2-shell')
    expect(caches.delete).not.toHaveBeenCalledWith('laudo-rapido-v3-shell')
    expect(caches.delete).not.toHaveBeenCalledWith('outro-app')
  })
})
