import { z } from 'zod'

import { acessoOuErro } from '@/lib/auth/acesso'
import { criarContaComSenha } from '@/lib/auth/conta'

const esquemaRegistro = z.object({
  nome: z.string().trim().min(1),
  empresa: z.string().trim().min(1),
  email: z.email(),
  senha: z.string().min(8),
})

export async function POST(req: Request) {
  // /registro permanece bloqueado na vitrine: só uma sessão já autorizada pela
  // allowlist pode criar outra conta. Sem cookie → 401; e-mail negado → 403.
  const resultado = await acessoOuErro(req)
  if ('resposta' in resultado) return resultado.resposta

  let corpo: unknown
  try {
    corpo = await req.json()
  } catch {
    return Response.json({ ok: false, erro: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  const dados = esquemaRegistro.safeParse(corpo)
  if (!dados.success) {
    return Response.json({ ok: false, erro: 'Dados de cadastro inválidos.' }, { status: 400 })
  }

  const conta = await criarContaComSenha(dados.data)
  if (!conta.ok) {
    return Response.json({ ok: false, erro: conta.erro }, { status: 400 })
  }

  const demo = conta.envio.modo === 'demo' ? conta.envio : null
  return Response.json(
    {
      ok: true,
      mensagem: 'Verifique seu e-mail para ativar a conta.',
      ...(demo ? { link: demo.link, token: demo.token } : {}),
    },
    { status: 201 },
  )
}
