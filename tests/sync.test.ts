import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'

const mocks = vi.hoisted(() => ({
  salvarFoto: vi.fn(),
  salvarAssinatura: vi.fn(),
}))

vi.mock('../src/lib/storage/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/storage/client')>()
  return { ...original, salvarFoto: mocks.salvarFoto, salvarAssinatura: mocks.salvarAssinatura }
})

import { sincronizarLote } from '../src/lib/visita/sync'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { listarVisitas } from '../src/lib/visita/service'
import { assinaturas, empresas, fotos, visitas } from '../src/lib/db/schema'

beforeEach(() => {
  mocks.salvarFoto.mockReset()
  mocks.salvarAssinatura.mockReset()
})

afterEach(() => setBancoAtivo(undefined))

const base = {
  clientId: '22222222-2222-4222-8222-222222222222',
  dados: { cliente: 'Oficina Brasil', tipo: 'Elétrica', observacoes: 'OK' },
  capturadoEm: new Date('2026-11-17T08:30:00Z'),
  fotos: [],
}

describe('sincronização', () => {
  it('é idempotente e preserva capturado_em', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresa] = await db.insert(empresas).values({ nome: 'Empresa A' }).returning()
    const r1 = await sincronizarLote([base], empresa.id)
    const r2 = await sincronizarLote([base], empresa.id)
    expect(r1).toEqual({ criadas: 1, duplicadas: 0 })
    expect(r2).toEqual({ criadas: 0, duplicadas: 1 })
    const lista = await listarVisitas(empresa.id)
    expect(lista[0].capturadoEm.toISOString()).toBe('2026-11-17T08:30:00.000Z')
  })

  it('faz rollback quando o upload falha e conclui na nova tentativa', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresa] = await db.insert(empresas).values({ nome: 'Empresa com mídia' }).returning()
    const clientId = '55555555-5555-4555-8555-555555555555'
    const item = {
      clientId,
      dados: { cliente: 'Oficina Brasil', tipo: 'Elétrica', observacoes: 'Com foto' },
      capturadoEm: new Date('2026-11-17T08:30:00Z'),
      fotos: [
        {
          blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
          capturadoEm: new Date('2026-11-17T09:15:00Z'),
        },
      ],
    }
    const onde = and(eq(visitas.empresaId, empresa.id), eq(visitas.clientId, clientId))

    mocks.salvarFoto.mockRejectedValueOnce(new Error('R2 indisponível'))
    await expect(sincronizarLote([item], empresa.id)).rejects.toThrow('R2 indisponível')
    expect(await db.select().from(visitas).where(onde)).toHaveLength(0)

    mocks.salvarFoto.mockResolvedValue('https://r2.example/foto.png')
    const resultado = await sincronizarLote([item], empresa.id)
    expect(resultado).toEqual({ criadas: 1, duplicadas: 0 })

    const [visita] = await db.select().from(visitas).where(onde)
    expect(visita).toBeDefined()
    const fotosSalvas = await db.select().from(fotos).where(eq(fotos.visitaId, visita.id))
    expect(fotosSalvas).toHaveLength(1)
    expect(fotosSalvas[0].url).toBe('https://r2.example/foto.png')
    expect(fotosSalvas[0].capturadoEm.toISOString()).toBe('2026-11-17T09:15:00.000Z')
    expect(await db.select().from(assinaturas).where(eq(assinaturas.visitaId, visita.id))).toHaveLength(0)
    expect(mocks.salvarFoto).toHaveBeenCalledTimes(2)
  })
})
