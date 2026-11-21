import { afterEach, describe, expect, it } from 'vitest'

import {
  acessoOuErro,
  emailPermitido,
  ERRO_ACESSO,
  exigirAcesso,
} from '../src/lib/auth/acesso'
import { criarSessao } from '../src/lib/auth/session'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, usuarios } from '../src/lib/db/schema'
import { ERRO_SESSAO } from '../src/lib/visita/acesso'

const EMAIL_PERMITIDO_ORIGINAL = process.env.EMAIL_PERMITIDO

afterEach(() => {
  setBancoAtivo(undefined)
  if (EMAIL_PERMITIDO_ORIGINAL === undefined) {
    delete process.env.EMAIL_PERMITIDO
  } else {
    process.env.EMAIL_PERMITIDO = EMAIL_PERMITIDO_ORIGINAL
  }
})

async function reqComSessao(
  email: string,
): Promise<{ req: Request; usuarioId: string; empresaId: string }> {
  setBancoAtivo(await criarBancoTeste())
  const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Acesso' }).returning()
  const [usuario] = await db
    .insert(usuarios)
    .values({ empresaId: empresa.id, email })
    .returning()
  const token = await criarSessao(usuario.id, empresa.id)
  const req = new Request('http://localhost/', { headers: { cookie: `sessao=${token}` } })
  return { req, usuarioId: usuario.id, empresaId: empresa.id }
}

describe('allowlist e helper de acesso', () => {
  it('normaliza o e-mail e aceita o endereço permitido', () => {
    process.env.EMAIL_PERMITIDO = 'macedoartur1250@gmail.com'
    expect(emailPermitido('  MACEDOARTUR1250@GMAIL.COM ')).toBe(true)
  })

  it('rejeita e-mail fora da allowlist', () => {
    process.env.EMAIL_PERMITIDO = 'macedoartur1250@gmail.com'
    expect(emailPermitido('outro@gmail.com')).toBe(false)
  })

  it('nega exigirAcesso sem EMAIL_PERMITIDO (fail closed)', async () => {
    const { req } = await reqComSessao('macedoartur1250@gmail.com')
    delete process.env.EMAIL_PERMITIDO
    await expect(exigirAcesso(req)).resolves.toBeNull()
  })

  it('devolve 403 sem EMAIL_PERMITIDO (fail closed)', async () => {
    const { req } = await reqComSessao('macedoartur1250@gmail.com')
    delete process.env.EMAIL_PERMITIDO
    const resultado = await acessoOuErro(req)
    expect('resposta' in resultado).toBe(true)
    if ('resposta' in resultado) {
      expect(resultado.resposta.status).toBe(403)
      await expect(resultado.resposta.json()).resolves.toEqual(ERRO_ACESSO)
    }
  })

  it('devolve os dados de acesso para e-mail permitido', async () => {
    process.env.EMAIL_PERMITIDO = 'macedoartur1250@gmail.com'
    const { req, usuarioId, empresaId } = await reqComSessao('macedoartur1250@gmail.com')
    await expect(exigirAcesso(req)).resolves.toEqual({
      usuarioId,
      empresaId,
      email: 'macedoartur1250@gmail.com',
    })
  })

  it('devolve 403 com ERRO_ACESSO para e-mail não permitido', async () => {
    process.env.EMAIL_PERMITIDO = 'macedoartur1250@gmail.com'
    const { req } = await reqComSessao('outro@gmail.com')
    const resultado = await acessoOuErro(req)
    expect('resposta' in resultado).toBe(true)
    if ('resposta' in resultado) {
      expect(resultado.resposta.status).toBe(403)
      await expect(resultado.resposta.json()).resolves.toEqual(ERRO_ACESSO)
    }
  })

  it('devolve 401 com ERRO_SESSAO para requisição sem cookie', async () => {
    process.env.EMAIL_PERMITIDO = 'macedoartur1250@gmail.com'
    setBancoAtivo(await criarBancoTeste())
    const resultado = await acessoOuErro(new Request('http://localhost/'))
    expect('resposta' in resultado).toBe(true)
    if ('resposta' in resultado) {
      expect(resultado.resposta.status).toBe(401)
      await expect(resultado.resposta.json()).resolves.toEqual(ERRO_SESSAO)
    }
  })
})
