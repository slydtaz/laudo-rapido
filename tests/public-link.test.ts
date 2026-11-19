import { afterEach, describe, expect, it } from 'vitest'
import { buscarVisitaPublica } from '../src/lib/visita/publico'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, visitas } from '../src/lib/db/schema'

afterEach(() => setBancoAtivo(undefined))

describe('link público', () => {
  it('retorna null para token inexistente', async () => {
    setBancoAtivo(await criarBancoTeste())
    await expect(buscarVisitaPublica('token-invalido')).resolves.toBeNull()
  })

  it('carrega o nome do prestador para identificar o laudo', async () => {
    setBancoAtivo(await criarBancoTeste())
    const [empresa] = await db.insert(empresas).values({ nome: 'Oficina Central' }).returning()
    const [visita] = await db
      .insert(visitas)
      .values({
        empresaId: empresa.id,
        clientId: '66666666-6666-4666-8666-666666666666',
        status: 'entregue',
        dados: { cliente: 'Padaria Central' },
        token: 'token-com-prestador',
        capturadoEm: new Date('2026-11-18T10:00:00Z'),
      })
      .returning()

    const encontrada = await buscarVisitaPublica(visita.token ?? 'token-com-prestador')
    expect(encontrada?.nomePrestador).toBe('Oficina Central')
  })
})
