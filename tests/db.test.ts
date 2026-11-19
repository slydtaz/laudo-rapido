import { describe, expect, it } from 'vitest'
import { criarBancoTeste } from '../src/lib/db/client'
import { empresas, visitas, fotos, assinaturas } from '../src/lib/db/schema'

describe('schema', () => {
  it('persiste visita com foto e assinatura e impõe client_id único', async () => {
    const db = await criarBancoTeste()
    const [empresa] = await db.insert(empresas).values({ nome: 'Climatizar' }).returning()
    const [visita] = await db.insert(visitas).values({
      empresaId: empresa.id,
      modeloId: null,
      clientId: '11111111-1111-4111-8111-111111111111',
      status: 'sincronizada',
      dados: { cliente: 'Padaria Central' },
      capturadoEm: new Date('2026-11-18T10:00:00Z'),
    }).returning()
    await db.insert(fotos).values({ visitaId: visita.id, url: 'r2://a.png', capturadoEm: new Date() })
    await db.insert(assinaturas).values({ visitaId: visita.id, url: 'r2://sign.png' })
    await expect(
      db.insert(visitas).values({
        empresaId: empresa.id,
        clientId: visita.clientId,
        status: 'sincronizada',
        dados: {},
        capturadoEm: new Date(),
      })
    ).rejects.toThrow()
  })
})
