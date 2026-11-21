import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { GET, PUT } from '../src/app/api/v1/configuracao/route'
import type { Configuracao } from '../src/lib/configuracao/modelo'
import { lerConfiguracao } from '../src/lib/configuracao/servico'
import { COOKIE_SESSAO, criarSessao } from '../src/lib/auth/session'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { configuracaoApp, empresas, usuarios } from '../src/lib/db/schema'
import { ERRO_ACESSO } from '../src/lib/auth/acesso'
import { ERRO_SESSAO } from '../src/lib/visita/acesso'

const EMAIL_PERMITIDO_ORIGINAL = process.env.EMAIL_PERMITIDO
const EMAIL_LIBERADO = 'macedoartur1250@gmail.com'

const PADRAO = { versao: 1, textos: {}, planos: [] }

let tokenPermitido: string
let tokenNegado: string

function req(token: string | null, corpo?: unknown, metodo = 'GET'): Request {
  return new Request('http://localhost/api/v1/configuracao', {
    method: metodo,
    headers: {
      ...(token ? { cookie: `${COOKIE_SESSAO}=${token}` } : {}),
      ...(corpo === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
}

function configValida(): Configuracao {
  return {
    versao: 1,
    textos: { loginBotao: 'Entrar agora' },
    planos: [
      {
        id: 'planoPro',
        nome: 'Pro',
        preco: 'R$ 29,90',
        dica: 'Para quem vive de visita técnica.',
        itens: 'Tudo do Gratuito;Sem anúncios',
      },
    ],
  }
}

beforeEach(async () => {
  process.env.EMAIL_PERMITIDO = EMAIL_LIBERADO
  setBancoAtivo(await criarBancoTeste())

  const [empresaPermitida] = await db.insert(empresas).values({ nome: 'Empresa liberada' }).returning()
  const [empresaNegada] = await db.insert(empresas).values({ nome: 'Empresa negada' }).returning()
  const [usuarioPermitido] = await db
    .insert(usuarios)
    .values({ empresaId: empresaPermitida.id, email: EMAIL_LIBERADO })
    .returning()
  const [usuarioNegado] = await db
    .insert(usuarios)
    .values({ empresaId: empresaNegada.id, email: 'outro@gmail.com' })
    .returning()

  tokenPermitido = await criarSessao(usuarioPermitido.id, empresaPermitida.id)
  tokenNegado = await criarSessao(usuarioNegado.id, empresaNegada.id)
})

afterEach(() => {
  setBancoAtivo(undefined)
  if (EMAIL_PERMITIDO_ORIGINAL === undefined) {
    delete process.env.EMAIL_PERMITIDO
  } else {
    process.env.EMAIL_PERMITIDO = EMAIL_PERMITIDO_ORIGINAL
  }
})

describe('GET /api/v1/configuracao', () => {
  it('devolve 401 sem sessão', async () => {
    const resposta = await GET(req(null))
    expect(resposta.status).toBe(401)
    expect(await resposta.json()).toEqual(ERRO_SESSAO)
  })

  it('devolve 403 para sessão de outro e-mail', async () => {
    const resposta = await GET(req(tokenNegado))
    expect(resposta.status).toBe(403)
    expect(await resposta.json()).toEqual(ERRO_ACESSO)
  })

  it('devolve o objeto padrão com no-store quando a tabela está vazia', async () => {
    const resposta = await GET(req(tokenPermitido))
    expect(resposta.status).toBe(200)
    expect(resposta.headers.get('cache-control')).toBe('no-store')
    expect(await resposta.json()).toEqual(PADRAO)
  })

  it('lerConfiguracao devolve o objeto padrão quando não há linha', async () => {
    await expect(lerConfiguracao()).resolves.toEqual(PADRAO)
  })
})

describe('PUT /api/v1/configuracao', () => {
  it('também exige sessão e e-mail permitido', async () => {
    const semSessao = await PUT(req(null, configValida(), 'PUT'))
    expect(semSessao.status).toBe(401)
    const outroEmail = await PUT(req(tokenNegado, configValida(), 'PUT'))
    expect(outroEmail.status).toBe(403)
    await expect(lerConfiguracao()).resolves.toEqual(PADRAO)
  })

  it('rejeita chave de texto desconhecida com 400', async () => {
    const resposta = await PUT(
      req(
        tokenPermitido,
        { versao: 1, textos: { chaveQueNaoExiste: 'qualquer' }, planos: [] },
        'PUT',
      ),
    )
    expect(resposta.status).toBe(400)
    await expect(lerConfiguracao()).resolves.toEqual(PADRAO)
  })

  it('rejeita id de plano fora dos quatro permitidos com 400', async () => {
    const resposta = await PUT(
      req(
        tokenPermitido,
        {
          versao: 1,
          textos: {},
          planos: [
            { id: 'planoInexistente', nome: 'X', preco: '0', dica: '', itens: '' },
          ],
        },
        'PUT',
      ),
    )
    expect(resposta.status).toBe(400)
    await expect(lerConfiguracao()).resolves.toEqual(PADRAO)
  })

  it('salva payload válido com 201 e lerConfiguracao devolve o salvo', async () => {
    const configuracao = configValida()
    const resposta = await PUT(req(tokenPermitido, configuracao, 'PUT'))
    expect(resposta.status).toBe(201)
    expect(await resposta.json()).toEqual(configuracao)
    await expect(lerConfiguracao()).resolves.toEqual(configuracao)
    const get = await GET(req(tokenPermitido))
    expect(await get.json()).toEqual(configuracao)
  })

  it('mantém <script> em nome como texto puro, sem escape', async () => {
    const nome = '<script>alert(1)</script>'
    const configuracao: Configuracao = {
      versao: 1,
      textos: {},
      planos: [
        { id: 'planoGratuito', nome, preco: 'R$ 0', dica: '', itens: '' },
      ],
    }
    const resposta = await PUT(req(tokenPermitido, configuracao, 'PUT'))
    expect(resposta.status).toBe(201)

    const salvo = await lerConfiguracao()
    expect(typeof salvo.planos[0].nome).toBe('string')
    expect(salvo.planos[0].nome).toBe(nome)
    expect(salvo.planos[0].nome).not.toContain('&lt;script&gt;')
  })

  it('substitui a única linha de chave app em saves sucessivos', async () => {
    const primeira = configValida()
    const segunda: Configuracao = {
      versao: 2,
      textos: { loginBotao: 'Acessar' },
      planos: [
        { id: 'planoEquipe', nome: 'Equipe', preco: 'R$ 79,90', dica: '', itens: '' },
      ],
    }

    await PUT(req(tokenPermitido, primeira, 'PUT'))
    await PUT(req(tokenPermitido, segunda, 'PUT'))

    const linhas = await db.select().from(configuracaoApp)
    expect(linhas).toHaveLength(1)
    expect(linhas[0].chave).toBe('app')
    await expect(lerConfiguracao()).resolves.toEqual(segunda)
  })
})
