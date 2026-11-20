import { z } from 'zod'

import { reenviarVerificacao } from '@/lib/auth/conta'

const esquema = z.object({ email: z.email() })

/** Sempre 202 e sempre o mesmo corpo: não revela se a conta existe. */
export async function POST(req: Request) {
  try {
    const dados = esquema.safeParse(await req.json())
    if (dados.success) {
      await reenviarVerificacao(dados.data.email)
    }
  } catch {
    // Resposta idêntica para corpo inválido.
  }
  return Response.json({ ok: true }, { status: 202 })
}
