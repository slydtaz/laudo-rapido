import { afterEach, describe, expect, it } from 'vitest'
import { sincronizarLote } from '../src/lib/visita/sync'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { listarVisitas } from '../src/lib/visita/service'
import { empresas } from '../src/lib/db/schema'

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
})
