import { lerSessao } from '@/lib/auth/session'
import { visitaDto } from '@/lib/visita/dto'
import { criarVisita, criarVisitaSchema, listarVisitas } from '@/lib/visita/service'

const ERRO_SESSAO = { erro: 'Sessão inválida ou expirada.' }

export async function GET(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }

  const visitas = await listarVisitas(sessao.empresaId)
  return Response.json({ visitas: visitas.map(visitaDto) })
}

export async function POST(req: Request) {
  const sessao = await lerSessao(req)
  if (!sessao) {
    return Response.json(ERRO_SESSAO, { status: 401 })
  }

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = criarVisitaSchema.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ erro: 'Dados da visita inválidos.' }, { status: 400 })
  }

  // RF-08: o tenant vem da sessão; qualquer empresaId no corpo é ignorado.
  const visita = await criarVisita(dados.data, sessao.empresaId)
  return Response.json({ visita: visitaDto(visita) }, { status: 201 })
}
