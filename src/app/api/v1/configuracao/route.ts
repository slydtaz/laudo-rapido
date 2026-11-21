import { acessoOuErro } from '@/lib/auth/acesso'
import { configuracaoSchema } from '@/lib/configuracao/modelo'
import { lerConfiguracao, salvarConfiguracao } from '@/lib/configuracao/servico'

const CABECALHOS = { 'Cache-Control': 'no-store' }

export async function GET(req: Request) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta

  return Response.json(await lerConfiguracao(), { headers: CABECALHOS })
}

export async function PUT(req: Request) {
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = configuracaoSchema.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ erro: 'Configuração inválida.' }, { status: 400 })
  }

  const salvo = await salvarConfiguracao(dados.data)
  return Response.json(salvo, { status: 201, headers: CABECALHOS })
}
