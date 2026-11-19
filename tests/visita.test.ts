import { afterEach, describe, expect, it } from 'vitest'
import { criarVisitaSchema, criarVisita, listarVisitas } from '../src/lib/visita/service'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas } from '../src/lib/db/schema'

afterEach(() => setBancoAtivo(undefined))

const novaVisita = (clientId: string) => ({
  clientId,
  dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'Filtro trocado' },
  capturadoEm: new Date('2026-11-18T10:00:00Z'),
})

describe('domínio de visitas', () => {
  it('rejeita observação longa demais', () => {
    const result = criarVisitaSchema.safeParse({
      ...novaVisita('11111111-1111-4111-8111-111111111111'),
      dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'x'.repeat(2001) },
    })
    expect(result.success).toBe(false)
  })

  it('isola visitas por empresa', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresaA] = await db.insert(empresas).values({ nome: 'Empresa A' }).returning()
    const [empresaB] = await db.insert(empresas).values({ nome: 'Empresa B' }).returning()
    const a = await criarVisita(novaVisita('33333333-3333-4333-8333-333333333333'), empresaA.id)
    const b = await criarVisita(novaVisita('44444444-4444-4444-8444-444444444444'), empresaB.id)
    const listaA = await listarVisitas(empresaA.id)
    expect(listaA.map((v) => v.clientId)).not.toContain(b.clientId)
    expect(a.status).toBe('sincronizada')
  })
})
