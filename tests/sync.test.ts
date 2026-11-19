import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { and, eq } from 'drizzle-orm'
import sharp from 'sharp'

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
  it('é idempotente, preserva capturado_em e devolve o token nas duplicatas', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresa] = await db.insert(empresas).values({ nome: 'Empresa A' }).returning()
    const r1 = await sincronizarLote([base], empresa.id)
    const r2 = await sincronizarLote([base], empresa.id)
    const lista = await listarVisitas(empresa.id)

    expect(r1.criadas).toBe(1)
    expect(r1.duplicadas).toBe(0)
    expect(r2.criadas).toBe(0)
    expect(r2.duplicadas).toBe(1)
    expect(r1.entregas).toHaveLength(1)
    expect(r2.entregas).toHaveLength(1)
    expect(r1.entregas[0].clientId).toBe(base.clientId)
    expect(r1.entregas[0].visitaId).toBe(lista[0].id)
    expect(r1.entregas[0].token).toBe(lista[0].token)
    // O retry precisa recuperar exatamente o mesmo link de entrega.
    expect(r2.entregas[0]).toEqual(r1.entregas[0])
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
    expect(resultado.criadas).toBe(1)
    expect(resultado.duplicadas).toBe(0)

    const [visita] = await db.select().from(visitas).where(onde)
    expect(visita).toBeDefined()
    const fotosSalvas = await db.select().from(fotos).where(eq(fotos.visitaId, visita.id))
    expect(fotosSalvas).toHaveLength(1)
    expect(fotosSalvas[0].url).toBe('https://r2.example/foto.png')
    expect(fotosSalvas[0].capturadoEm.toISOString()).toBe('2026-11-17T09:15:00.000Z')
    expect(await db.select().from(assinaturas).where(eq(assinaturas.visitaId, visita.id))).toHaveLength(0)
    expect(mocks.salvarFoto).toHaveBeenCalledTimes(2)
  })

  it('normaliza a assinatura offline com DPR alto e transparência', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresa] = await db.insert(empresas).values({ nome: 'Empresa com assinatura' }).returning()
    const clientId = '77777777-7777-4777-8777-777777777777'

    // PNG 2400×800 com canal alfa, como o canvas de um tablet com DPR 3.
    const pngAlto = await sharp({
      create: {
        width: 2400,
        height: 800,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0 },
      },
    })
      .png()
      .toBuffer()

    const item = {
      clientId,
      dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'Assinado' },
      capturadoEm: new Date('2026-11-17T08:30:00Z'),
      fotos: [],
      assinatura: new Blob([pngAlto], { type: 'image/png' }),
    }
    mocks.salvarAssinatura.mockResolvedValue('https://r2.example/assinatura.png')

    const resultado = await sincronizarLote([item], empresa.id)
    expect(resultado.criadas).toBe(1)
    expect(mocks.salvarAssinatura).toHaveBeenCalledTimes(1)

    const enviado = mocks.salvarAssinatura.mock.calls[0][1] as Buffer
    const meta = await sharp(enviado).metadata()
    expect(meta.width).toBeLessThanOrEqual(1200)
    expect(meta.height).toBeLessThanOrEqual(400)
    expect(meta.hasAlpha).toBe(false)
    expect(enviado.subarray(1, 4).toString()).toBe('PNG')

    const [visita] = await db
      .select()
      .from(visitas)
      .where(and(eq(visitas.empresaId, empresa.id), eq(visitas.clientId, clientId)))
    const assinaturasSalvas = await db
      .select()
      .from(assinaturas)
      .where(eq(assinaturas.visitaId, visita.id))
    expect(assinaturasSalvas).toHaveLength(1)
    expect(assinaturasSalvas[0].url).toBe('https://r2.example/assinatura.png')
  })
})
