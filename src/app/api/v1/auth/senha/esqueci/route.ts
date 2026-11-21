import { z } from 'zod'

import { solicitarRedefinicao } from '@/lib/auth/conta'
import {
  MENSAGEM_BLOQUEIO,
  chaveTentativa,
  ipDaRequisicao,
  registrarTentativa,
} from '@/lib/auth/rate-limit'

const esquema = z.object({ email: z.email() })

/** Sempre 202 e sempre o mesmo corpo: não revela se a conta existe. */
export async function POST(req: Request) {
  let email: string | undefined
  try {
    const dados = esquema.safeParse(await req.json())
    if (dados.success) {
      email = dados.data.email
    }
  } catch {
    // Resposta idêntica para corpo inválido.
  }

  if (email) {
    const { bloqueado } = await registrarTentativa(
      chaveTentativa(ipDaRequisicao(req), email),
    )
    if (bloqueado) {
      return Response.json({ erro: MENSAGEM_BLOQUEIO }, { status: 429 })
    }
    try {
      await solicitarRedefinicao(email)
    } catch {
      // Resposta idêntica para falha de envio.
    }
  }

  return Response.json({ ok: true }, { status: 202 })
}
