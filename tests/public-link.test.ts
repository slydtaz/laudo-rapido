import { afterEach, describe, expect, it } from 'vitest'
import { buscarVisitaPublica } from '../src/lib/visita/publico'
import { criarBancoTeste, setBancoAtivo } from '../src/lib/db/client'

afterEach(() => setBancoAtivo(undefined))

describe('link público', () => {
  it('retorna null para token inexistente', async () => {
    setBancoAtivo(await criarBancoTeste())
    await expect(buscarVisitaPublica('token-invalido')).resolves.toBeNull()
  })
})
