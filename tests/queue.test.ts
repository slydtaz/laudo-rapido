import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const EMPRESA_A = 'empresa-a'
const EMPRESA_B = 'empresa-b'

type Pendencia = { clientId: string; empresaId: string; criadoEm: Date }
type Entrega = {
  clientId: string
  empresaId: string
  visitaId: string
  token: string
  criadoEm: Date
}

const estado = vi.hoisted(() => ({
  visitas: new Map<string, unknown>(),
  pendencias: new Map<string, Pendencia>(),
  entregas: [] as Entrega[],
}))

// IndexedDB não existe no ambiente node: substituímos o Dexie por stubs em
// memória. Os stubs de `where('empresaId').equals(...)` reproduzem o índice
// usado pela implementação para provar o isolamento entre tenants.
vi.mock('../src/lib/offline/db', () => ({
  fila: {
    visitas: {
      get: (id: string) => Promise.resolve(estado.visitas.get(id)),
      put: (visita: { clientId: string }) => {
        estado.visitas.set(visita.clientId, visita)
        return Promise.resolve(visita.clientId)
      },
    },
    pendencias: {
      where: (_campo: string) => ({
        equals: (empresaId: string) => ({
          sortBy: (_campo: string) =>
            Promise.resolve(
              [...estado.pendencias.values()]
                .filter((pendencia) => pendencia.empresaId === empresaId)
                .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime()),
            ),
          count: () =>
            Promise.resolve(
              [...estado.pendencias.values()].filter(
                (pendencia) => pendencia.empresaId === empresaId,
              ).length,
            ),
        }),
      }),
      put: (pendencia: Pendencia) => {
        estado.pendencias.set(pendencia.clientId, pendencia)
        return Promise.resolve(pendencia.clientId)
      },
      delete: (id: string) => {
        estado.pendencias.delete(id)
        return Promise.resolve()
      },
    },
    entregas: {
      put: (entrega: Entrega) => {
        estado.entregas.push(entrega)
        return Promise.resolve(entrega.clientId)
      },
      where: (_campo: string) => ({
        equals: (empresaId: string) => ({
          sortBy: (_campo: string) =>
            Promise.resolve(estado.entregas.filter((entrega) => entrega.empresaId === empresaId)),
        }),
      }),
    },
    transaction: (...args: unknown[]) => {
      const fn = args.at(-1)
      if (typeof fn !== 'function') {
        throw new Error('transaction sem callback')
      }
      return fn()
    },
  },
}))

import {
  enfileirarVisita,
  entregasSalvas,
  pendenciasRestantes,
  sincronizarFila,
  type VisitaLocal,
} from '../src/lib/offline/queue'

const fetchMock = vi.fn()

beforeEach(() => {
  estado.visitas.clear()
  estado.pendencias.clear()
  estado.entregas.length = 0
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

function visita(clientId: string, comFoto = true): VisitaLocal {
  return {
    clientId,
    dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'Serviço concluído' },
    capturadoEm: new Date('2026-11-18T10:00:00Z'),
    fotos: comFoto
      ? [
          {
            blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
            capturadoEm: new Date('2026-11-18T10:01:00Z'),
          },
        ]
      : [],
  }
}

/** Resposta de sucesso cujo token identifica a visita enviada. */
function respostaOk(_url: string, init: RequestInit): Response {
  const corpo = init.body
  let clientId: string
  if (typeof corpo === 'string') {
    clientId = (JSON.parse(corpo) as { clientId: string }[])[0].clientId
  } else {
    const lote = JSON.parse((corpo as FormData).get('lote') as string) as { clientId: string }[]
    clientId = lote[0].clientId
  }
  return Response.json({
    criadas: 1,
    duplicadas: 0,
    entregas: [{ clientId, visitaId: `visita-${clientId}`, token: `token-${clientId}` }],
  })
}

describe('fila offline', () => {
  it('envia uma requisição por visita com mídia e persiste os links de entrega', async () => {
    const id1 = '11111111-1111-4111-8111-111111111111'
    const id2 = '22222222-2222-4222-8222-222222222222'
    await enfileirarVisita(visita(id1), EMPRESA_A)
    await enfileirarVisita(visita(id2), EMPRESA_A)
    fetchMock.mockImplementation(respostaOk)

    const resultado = await sincronizarFila(EMPRESA_A)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(resultado.enviadas).toBe(2)
    expect(resultado.falhas).toBe(0)
    expect(resultado.errosTamanho).toBe(0)
    expect(resultado.entregas.map((entrega) => entrega.clientId)).toEqual([id1, id2])
    expect(resultado.entregas.every((entrega) => entrega.empresaId === EMPRESA_A)).toBe(true)
    expect(await pendenciasRestantes(EMPRESA_A)).toBe(0)
    expect((await entregasSalvas(EMPRESA_A)).map((entrega) => entrega.token)).toEqual([
      `token-${id2}`,
      `token-${id1}`,
    ])
  })

  it('reporta 413 como erro de tamanho e mantém a pendência', async () => {
    await enfileirarVisita(visita('33333333-3333-4333-8333-333333333333'), EMPRESA_A)
    fetchMock.mockResolvedValue(new Response('Payload Too Large', { status: 413 }))

    const resultado = await sincronizarFila(EMPRESA_A)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resultado.enviadas).toBe(0)
    expect(resultado.errosTamanho).toBe(1)
    expect(resultado.falhas).toBe(0)
    expect(await pendenciasRestantes(EMPRESA_A)).toBe(1)
  })

  it('mantém a pendência na falha de rede e a limpa em duplicata legítima', async () => {
    const id = '44444444-4444-4444-8444-444444444444'
    await enfileirarVisita(visita(id), EMPRESA_A)
    fetchMock.mockRejectedValueOnce(new Error('sem rede'))

    const primeira = await sincronizarFila(EMPRESA_A)
    expect(primeira.falhas).toBe(1)
    expect(await pendenciasRestantes(EMPRESA_A)).toBe(1)

    fetchMock.mockResolvedValueOnce(
      Response.json({
        criadas: 0,
        duplicadas: 1,
        entregas: [{ clientId: id, visitaId: 'visita-existente', token: 'token-original' }],
      }),
    )
    const segunda = await sincronizarFila(EMPRESA_A)
    expect(segunda.enviadas).toBe(1)
    expect(segunda.entregas[0].token).toBe('token-original')
    expect(await pendenciasRestantes(EMPRESA_A)).toBe(0)
  })

  it('não envia nem expõe pendências/links de outro tenant no mesmo aparelho', async () => {
    const idA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const idB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    await enfileirarVisita(visita(idA), EMPRESA_A)
    await enfileirarVisita(visita(idB), EMPRESA_B)
    fetchMock.mockImplementation(respostaOk)

    // A sessão ativa é a da empresa A: somente a visita dela pode sair.
    const resultado = await sincronizarFila(EMPRESA_A)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(resultado.enviadas).toBe(1)
    expect(resultado.entregas.map((entrega) => entrega.clientId)).toEqual([idA])
    expect((await entregasSalvas(EMPRESA_A)).map((entrega) => entrega.token)).toEqual([
      `token-${idA}`,
    ])
    expect(await entregasSalvas(EMPRESA_B)).toEqual([])

    // B continua pendente, intacta e invisível para a conta A.
    expect(await pendenciasRestantes(EMPRESA_A)).toBe(0)
    expect(await pendenciasRestantes(EMPRESA_B)).toBe(1)
    expect(estado.pendencias.get(idB)?.empresaId).toBe(EMPRESA_B)
    expect(estado.pendencias.has(idA)).toBe(false)
  })
})
