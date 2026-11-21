import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  salvarFoto: vi.fn(),
  salvarAssinatura: vi.fn(),
  gerarPdf: vi.fn(),
  headers: vi.fn(),
  redirect: vi.fn(),
}))

vi.mock('@/lib/storage/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/storage/client')>()
  return {
    ...original,
    salvarFoto: mocks.salvarFoto,
    salvarAssinatura: mocks.salvarAssinatura,
  }
})
vi.mock('@/lib/pdf/laudo', () => ({ gerarPdf: mocks.gerarPdf }))
vi.mock('next/headers', () => ({ headers: mocks.headers }))
vi.mock('next/navigation', () => ({
  redirect: mocks.redirect.mockImplementation((destino: string) => {
    throw new Error(`REDIRECT:${destino}`)
  }),
}))

import { GET as getSessao } from '../src/app/api/v1/sessao/route'
import { GET as getModelos, POST as postModelos } from '../src/app/api/v1/modelos/route'
import { GET as getVisitas, POST as postVisitas } from '../src/app/api/v1/visitas/route'
import { POST as postSync } from '../src/app/api/v1/visitas/sync/route'
import { GET as getConta, PATCH as patchConta } from '../src/app/api/v1/conta/route'
import { POST as postContaSenha } from '../src/app/api/v1/conta/senha/route'
import { GET as getPdf } from '../src/app/api/v1/visitas/[id]/pdf/route'
import { POST as postAssinar } from '../src/app/api/v1/visitas/[id]/assinar/route'
import { POST as postFotos } from '../src/app/api/v1/visitas/[id]/fotos/route'
import { POST as postRegistro } from '../src/app/api/v1/auth/registro/route'
import PaginaRegistro from '../src/app/registro/page'
import { ERRO_ACESSO } from '../src/lib/auth/acesso'
import { hashSenha } from '../src/lib/auth/password'
import { COOKIE_SESSAO, criarSessao } from '../src/lib/auth/session'
import { criarBancoTeste, db, setBancoAtivo } from '../src/lib/db/client'
import { empresas, usuarios, visitas } from '../src/lib/db/schema'
import { ERRO_SESSAO } from '../src/lib/visita/acesso'

const EMAIL_PERMITIDO_ORIGINAL = process.env.EMAIL_PERMITIDO
const EMAIL_LIBERADO = 'macedoartur1250@gmail.com'

// PNG 1x1 opaco: suficiente para as rotas de mídia validarem o data URL.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVQImWP4//8/AAX+Av5Y8msOAAAAAElFTkSuQmCC'

function itemVisita(clientId: string) {
  return {
    clientId,
    dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'Serviço concluído' },
    capturadoEm: '2026-11-20T10:00:00.000Z',
  }
}

type Contexto = { tokenPermitido: string; tokenNegado: string; visitaId: string }
type Caso = {
  nome: string
  metodo: string
  corpo?: (c: Contexto) => unknown
  statusPermitido: number
  executar: (req: Request, c: Contexto) => Promise<Response>
}

const casos: Caso[] = [
  {
    nome: 'GET /api/v1/sessao',
    metodo: 'GET',
    statusPermitido: 200,
    executar: (req) => getSessao(req),
  },
  {
    nome: 'GET /api/v1/modelos',
    metodo: 'GET',
    statusPermitido: 200,
    executar: (req) => getModelos(req),
  },
  {
    nome: 'POST /api/v1/modelos',
    metodo: 'POST',
    corpo: () => ({ nome: 'Modelo', campos: [] }),
    statusPermitido: 201,
    executar: (req) => postModelos(req),
  },
  {
    nome: 'GET /api/v1/visitas',
    metodo: 'GET',
    statusPermitido: 200,
    executar: (req) => getVisitas(req),
  },
  {
    nome: 'POST /api/v1/visitas',
    metodo: 'POST',
    corpo: () => itemVisita('11111111-1111-4111-8111-111111111111'),
    statusPermitido: 201,
    executar: (req) => postVisitas(req),
  },
  {
    nome: 'GET /api/v1/conta',
    metodo: 'GET',
    statusPermitido: 200,
    executar: (req) => getConta(req),
  },
  {
    nome: 'PATCH /api/v1/conta',
    metodo: 'PATCH',
    corpo: () => ({ nome: 'Nome Novo', empresa: 'Empresa Nova' }),
    statusPermitido: 200,
    executar: (req) => patchConta(req),
  },
  {
    nome: 'POST /api/v1/conta/senha',
    metodo: 'POST',
    corpo: () => ({ senhaAtual: 'senha-antiga-123', senhaNova: 'senha-nova-123' }),
    statusPermitido: 200,
    executar: (req) => postContaSenha(req),
  },
  {
    nome: 'POST /api/v1/visitas/sync',
    metodo: 'POST',
    corpo: () => [itemVisita('22222222-2222-4222-8222-222222222222')],
    statusPermitido: 200,
    executar: (req) => postSync(req),
  },
  {
    nome: 'GET /api/v1/visitas/[id]/pdf',
    metodo: 'GET',
    statusPermitido: 200,
    executar: (req, c) => getPdf(req, { params: Promise.resolve({ id: c.visitaId }) }),
  },
  {
    nome: 'POST /api/v1/visitas/[id]/assinar',
    metodo: 'POST',
    corpo: () => ({ dataUrl: PNG }),
    statusPermitido: 201,
    executar: (req, c) => postAssinar(req, { params: Promise.resolve({ id: c.visitaId }) }),
  },
  {
    nome: 'POST /api/v1/visitas/[id]/fotos',
    metodo: 'POST',
    corpo: () => ({ dataUrl: PNG }),
    statusPermitido: 201,
    executar: (req, c) => postFotos(req, { params: Promise.resolve({ id: c.visitaId }) }),
  },
  {
    nome: 'POST /api/v1/auth/registro',
    metodo: 'POST',
    corpo: () => ({
      nome: 'Ana',
      empresa: 'Climatizar',
      email: 'novo-registro@exemplo.local',
      senha: 'senha-forte-123',
    }),
    statusPermitido: 201,
    executar: (req) => postRegistro(req),
  },
]

let ctx: Contexto

function req(token: string | null, corpo?: unknown, metodo = 'GET'): Request {
  return new Request('http://localhost/api/v1/', {
    method: metodo,
    headers: {
      ...(token ? { cookie: `${COOKIE_SESSAO}=${token}` } : {}),
      ...(corpo === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  })
}

beforeEach(async () => {
  process.env.EMAIL_PERMITIDO = EMAIL_LIBERADO
  setBancoAtivo(await criarBancoTeste())
  mocks.salvarFoto.mockReset().mockResolvedValue('https://r2.example/foto.png')
  mocks.salvarAssinatura.mockReset().mockResolvedValue('https://r2.example/assinatura.png')
  mocks.gerarPdf.mockReset().mockResolvedValue(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]))
  mocks.headers.mockReset().mockResolvedValue(new Headers())
  mocks.redirect.mockClear()

  const [empresaPermitida] = await db.insert(empresas).values({ nome: 'Empresa liberada' }).returning()
  const [empresaNegada] = await db.insert(empresas).values({ nome: 'Empresa negada' }).returning()
  const [usuarioPermitido] = await db
    .insert(usuarios)
    .values({
      empresaId: empresaPermitida.id,
      email: EMAIL_LIBERADO,
      senhaHash: await hashSenha('senha-antiga-123'),
    })
    .returning()
  const [usuarioNegado] = await db
    .insert(usuarios)
    .values({ empresaId: empresaNegada.id, email: 'outro@gmail.com' })
    .returning()

  const tokenPermitido = await criarSessao(usuarioPermitido.id, empresaPermitida.id)
  const tokenNegado = await criarSessao(usuarioNegado.id, empresaNegada.id)
  const [visita] = await db
    .insert(visitas)
    .values({
      empresaId: empresaPermitida.id,
      clientId: '99999999-9999-4999-8999-999999999999',
      dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'Serviço concluído' },
      token: 'token-de-teste',
      capturadoEm: new Date('2026-11-19T10:00:00Z'),
    })
    .returning()

  ctx = { tokenPermitido, tokenNegado, visitaId: visita.id }
})

afterEach(() => {
  setBancoAtivo(undefined)
  if (EMAIL_PERMITIDO_ORIGINAL === undefined) {
    delete process.env.EMAIL_PERMITIDO
  } else {
    process.env.EMAIL_PERMITIDO = EMAIL_PERMITIDO_ORIGINAL
  }
})

describe('gate de allowlist nas APIs de dados', () => {
  it('devolve 403 com ERRO_ACESSO para sessão de outro e-mail', async () => {
    for (const caso of casos) {
      const resposta = await caso.executar(req(ctx.tokenNegado, caso.corpo?.(ctx), caso.metodo), ctx)
      expect(resposta.status, caso.nome).toBe(403)
      expect(await resposta.json(), caso.nome).toEqual(ERRO_ACESSO)
    }
  })

  it('devolve 401 para requisição sem cookie', async () => {
    for (const caso of casos) {
      const resposta = await caso.executar(req(null, caso.corpo?.(ctx), caso.metodo), ctx)
      expect(resposta.status, caso.nome).toBe(401)
      expect(await resposta.json(), caso.nome).toEqual(ERRO_SESSAO)
    }
  })

  it('mantém o status atual para o e-mail permitido', async () => {
    for (const caso of casos) {
      const resposta = await caso.executar(req(ctx.tokenPermitido, caso.corpo?.(ctx), caso.metodo), ctx)
      expect(resposta.status, caso.nome).toBe(caso.statusPermitido)
    }
  })
})

describe('gate server-side da página /registro', () => {
  it('redireciona sessão de outro e-mail para a tela neutra', async () => {
    mocks.headers.mockResolvedValue(new Headers({ cookie: `${COOKIE_SESSAO}=${ctx.tokenNegado}` }))
    await expect(PaginaRegistro()).rejects.toThrow('REDIRECT:/em-desenvolvimento')
  })

  it('redireciona requisição sem sessão para a tela neutra', async () => {
    mocks.headers.mockResolvedValue(new Headers())
    await expect(PaginaRegistro()).rejects.toThrow('REDIRECT:/em-desenvolvimento')
  })

  it('entrega o formulário ao e-mail permitido', async () => {
    mocks.headers.mockResolvedValue(new Headers({ cookie: `${COOKIE_SESSAO}=${ctx.tokenPermitido}` }))
    await expect(PaginaRegistro()).resolves.toBeDefined()
  })
})
