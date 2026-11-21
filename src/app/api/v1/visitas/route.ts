import { acessoOuErro } from '@/lib/auth/acesso'
import { visitaDto } from '@/lib/visita/dto'
import { criarVisita, criarVisitaSchema, listarVisitas } from '@/lib/visita/service'

export async function GET(req: Request) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta
  const { acesso } = resultado

  const visitas = await listarVisitas(acesso.empresaId)
  return Response.json({ visitas: visitas.map(visitaDto) })
}

export async function POST(req: Request) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta
  const { acesso } = resultado

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
  const visita = await criarVisita(dados.data, acesso.empresaId)
  return Response.json({ visita: visitaDto(visita) }, { status: 201 })
}
