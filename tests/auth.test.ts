import { afterEach, describe, expect, it } from 'vitest'
import { hashSenha, verificarSenha } from '../src/lib/auth/password'
import { criarSessao, lerSessao } from '../src/lib/auth/session'
import { criarBancoTeste, setBancoAtivo } from '../src/lib/db/client'

afterEach(() => setBancoAtivo(undefined))

describe('auth', () => {
  it('valida senha e mantém sessão com empresa', async () => {
    setBancoAtivo(await criarBancoTeste())
    const hash = await hashSenha('senha-forte-123')
    expect(await verificarSenha('errada', hash)).toBe(false)
    expect(await verificarSenha('senha-forte-123', hash)).toBe(true)
    const token = await criarSessao('u-1', 'e-1')
    const req = new Request('http://localhost/', { headers: { cookie: `sessao=${token}` } })
    await expect(lerSessao(req)).resolves.toEqual({ usuarioId: 'u-1', empresaId: 'e-1' })
  })
})
