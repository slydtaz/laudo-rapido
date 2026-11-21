import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { PATCH as salvarConta, GET as lerConta } from '../src/app/api/v1/conta/route'
import { POST as trocarSenhaRota } from '../src/app/api/v1/conta/senha/route'
import {
  atualizarNome,
  lerPerfil,
  trocarSenha,
} from '../src/lib/auth/conta'
import { hashSenha, verificarSenha } from '../src/lib/auth/password'
import { COOKIE_SESSAO, criarSessao } from '../src/lib/auth/session'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, usuarios } from '../src/lib/db/schema'

const EMAIL_PERMITIDO_ORIGINAL = process.env.EMAIL_PERMITIDO

beforeEach(() => {
  process.env.EMAIL_PERMITIDO = 'perfil@exemplo.local'
})

afterEach(() => {
  setBancoAtivo(undefined)
  if (EMAIL_PERMITIDO_ORIGINAL === undefined) {
    delete process.env.EMAIL_PERMITIDO
  } else {
    process.env.EMAIL_PERMITIDO = EMAIL_PERMITIDO_ORIGINAL
  }
})

async function base(opcoes: { comSenha?: boolean; verificado?: boolean } = {}) {
  setBancoAtivo(await criarBancoTeste())
  const [empresa] = await db.insert(empresas).values({ nome: 'Empresa Antiga' }).returning()
  const [usuario] = await db
    .insert(usuarios)
    .values({
      empresaId: empresa.id,
      email: 'perfil@exemplo.local',
      nome: 'Nome Antigo',
      senhaHash: opcoes.comSenha === false ? null : await hashSenha('senha-antiga-123'),
      emailVerificadoEm: opcoes.verificado ? new Date() : null,
      googleSub: opcoes.comSenha === false ? 'google-sub-1' : null,
    })
    .returning()
  return { usuario, empresa }
}

function req(token: string | null, corpo?: unknown, metodo = 'POST'): Request {
  return new Request('http://localhost/api/v1/conta', {
    method: corpo === undefined ? 'GET' : metodo,
    headers: {
      ...(token ? { cookie: `${COOKIE_SESSAO}=${token}` } : {}),
      'content-type': 'application/json',
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
}

describe('perfil e troca de senha', () => {
  it('lê o perfil sem expor campos sensíveis', async () => {
    const { usuario } = await base({ verificado: true })

    await expect(lerPerfil(usuario.id)).resolves.toEqual({
      nome: 'Nome Antigo',
      email: 'perfil@exemplo.local',
      empresa: 'Empresa Antiga',
      verificado: true,
      provedor: 'senha',
      criadoEm: expect.any(String),
    })
  })

  it('atualiza nome e empresa', async () => {
    const { usuario } = await base()
    await atualizarNome(usuario.id, 'Nome Novo', 'Empresa Nova')

    const [atualizado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    const [empresa] = await db.select().from(empresas).where(eq(empresas.id, usuario.empresaId))
    expect(atualizado.nome).toBe('Nome Novo')
    expect(empresa.nome).toBe('Empresa Nova')
  })

  it('exige a senha atual correta para conta com senha', async () => {
    const { usuario } = await base()

    await expect(
      trocarSenha(usuario.id, 'errada', 'senha-nova-123', null),
    ).resolves.toEqual({ ok: false, erro: 'Senha atual incorreta.' })
    await expect(
      trocarSenha(usuario.id, 'senha-antiga-123', 'senha-nova-123', null),
    ).resolves.toEqual({ ok: true })
    const [atualizado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(await verificarSenha('senha-nova-123', atualizado.senhaHash!)).toBe(true)
  })

  it('exige e-mail verificado para conta sem senha', async () => {
    const { usuario: naoVerificada } = await base({ comSenha: false, verificado: false })
    await expect(
      trocarSenha(naoVerificada.id, null, 'senha-nova-123', null),
    ).resolves.toEqual({ ok: false, erro: 'Verifique seu e-mail antes de criar uma senha.' })

    const { usuario: verificada } = await base({ comSenha: false, verificado: true })
    await expect(
      trocarSenha(verificada.id, null, 'senha-nova-123', null),
    ).resolves.toEqual({ ok: true })
  })

  it('apaga as outras sessões e mantém a atual', async () => {
    const { usuario } = await base()
    const atual = await criarSessao(usuario.id, usuario.empresaId)
    const outra = await criarSessao(usuario.id, usuario.empresaId)

    await trocarSenha(usuario.id, 'senha-antiga-123', 'senha-nova-123', atual)

    const respostaAtual = await lerConta(req(atual))
    expect(respostaAtual.status).toBe(200)
    const respostaOutra = await lerConta(req(outra))
    expect(respostaOutra.status).toBe(401)
  })

  it('as rotas derivam o usuário da sessão e nunca do corpo', async () => {
    const { usuario } = await base({ verificado: true })
    const token = await criarSessao(usuario.id, usuario.empresaId)

    expect((await lerConta(req(null))).status).toBe(401)
    const leitura = await lerConta(req(token))
    expect(await leitura.json()).toMatchObject({ email: 'perfil@exemplo.local', verificado: true })

    const alteracao = await salvarConta(
      req(token, { nome: 'Outro Nome', empresa: 'Outra Empresa' }, 'PATCH'),
    )
    expect(alteracao.status).toBe(200)
    const [atualizado] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(atualizado.nome).toBe('Outro Nome')

    const troca = await trocarSenhaRota(
      req(token, { senhaAtual: 'senha-antiga-123', senhaNova: 'senha-nova-123' }),
    )
    expect(troca.status).toBe(200)
    const [comNova] = await db.select().from(usuarios).where(eq(usuarios.id, usuario.id))
    expect(await verificarSenha('senha-nova-123', comNova.senhaHash!)).toBe(true)
  })
})
