import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import {
  JANELA_TENTATIVAS_MINUTOS,
  LIMITE_TENTATIVAS,
  chaveTentativa,
  ipDaRequisicao,
  registrarTentativa,
} from '../src/lib/auth/rate-limit'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { tentativasLogin } from '../src/lib/db/schema'

afterEach(() => setBancoAtivo(undefined))

describe('limite de tentativas', () => {
  it('extrai somente o primeiro IP de x-forwarded-for', () => {
    const req = new Request('http://localhost/api/', {
      headers: { 'x-forwarded-for': ' 203.0.113.10 , 10.0.0.1' },
    })
    expect(ipDaRequisicao(req)).toBe('203.0.113.10')
    expect(ipDaRequisicao(new Request('http://localhost/api/'))).toBeNull()
  })

  it('monta a chave com IP e e-mail normalizados, sem segredo nem log', () => {
    expect(chaveTentativa('203.0.113.10', '  Usuario@Exemplo.COM ')).toBe(
      '203.0.113.10:usuario@exemplo.com',
    )
    expect(chaveTentativa(null, 'USUARIO@exemplo.com')).toBe(
      'desconhecido:usuario@exemplo.com',
    )
    expect(chaveTentativa('  ', 'usuario@exemplo.com')).toBe(
      'desconhecido:usuario@exemplo.com',
    )
  })

  it('não bloqueia nas 9 primeiras tentativas e bloqueia na 10ª', async () => {
    setBancoAtivo(await criarBancoTeste())
    const chave = chaveTentativa('203.0.113.10', 'usuario@exemplo.com')

    expect(LIMITE_TENTATIVAS).toBe(10)
    expect(JANELA_TENTATIVAS_MINUTOS).toBe(15)

    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      expect(await registrarTentativa(chave)).toEqual({ bloqueado: false })
    }
    expect(await registrarTentativa(chave)).toEqual({ bloqueado: true })
  })

  it('mantém chaves diferentes independentes', async () => {
    setBancoAtivo(await criarBancoTeste())
    const chaveA = chaveTentativa('203.0.113.10', 'a@exemplo.com')
    const chaveB = chaveTentativa('203.0.113.11', 'b@exemplo.com')

    for (let tentativa = 0; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      await registrarTentativa(chaveA)
    }
    expect(await registrarTentativa(chaveA)).toEqual({ bloqueado: true })
    expect(await registrarTentativa(chaveB)).toEqual({ bloqueado: false })
  })

  it('reinicia a janela após 15 minutos sem tentativas', async () => {
    setBancoAtivo(await criarBancoTeste())
    const chave = chaveTentativa('203.0.113.10', 'usuario@exemplo.com')

    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      await registrarTentativa(chave)
    }
    expect(await registrarTentativa(chave)).toEqual({ bloqueado: true })

    const expirada = new Date(
      Date.now() - (JANELA_TENTATIVAS_MINUTOS + 1) * 60 * 1000,
    )
    await db
      .update(tentativasLogin)
      .set({ criadoEm: expirada })
      .where(eq(tentativasLogin.chave, chave))

    expect(await registrarTentativa(chave)).toEqual({ bloqueado: false })
  })
})
