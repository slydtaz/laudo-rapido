import { z } from 'zod'

import { criarContaComSenha } from '@/lib/auth/conta'

const esquemaRegistro = z.object({
  nome: z.string().trim().min(1),
  empresa: z.string().trim().min(1),
  email: z.email(),
  senha: z.string().min(8),
})

export async function POST(req: Request) {
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

  const resultado = await criarContaComSenha(dados.data)
  if (!resultado.ok) {
    return Response.json({ ok: false, erro: resultado.erro }, { status: 400 })
  }

  const demo = resultado.envio.modo === 'demo' ? resultado.envio : null
  return Response.json(
    {
      ok: true,
      mensagem: 'Verifique seu e-mail para ativar a conta.',
      ...(demo ? { link: demo.link, token: demo.token } : {}),
    },
    { status: 201 },
  )
}
