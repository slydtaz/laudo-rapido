import { z } from 'zod'

import type { Visita } from '../db/schema'

/**
 * Contrato de entrada compartilhado pelas rotas de visita e sincronização.
 * `clientId` é um UUIDv4 gerado no cliente: é a única chave de idempotência.
 */
export const criarVisitaSchema = z
  .object({
    clientId: z.uuid(),
    modeloId: z.uuid().optional(),
    // `strict()` também aqui: um `assinatura` dentro de dados não é campo
    // da visita e deve ser rejeitado, não silenciosamente descartado.
    dados: z
      .object({
        cliente: z.string().min(1),
        tipo: z.string().min(1),
        observacoes: z.string().max(2000),
      })
      .strict(),
    // Aceita tanto um Date (serviço) quanto uma string ISO (corpo JSON da rota).
    capturadoEm: z.coerce.date(),
  })
  .strict()

export type CriarVisita = z.infer<typeof criarVisitaSchema>

/**
 * Serialização para JSON: datas viram ISO 8601. `empresaId` fica de fora
 * porque o tenant é implícito na sessão autenticada (RF-08).
 */
export function visitaDto(visita: Visita) {
  return {
    id: visita.id,
    clientId: visita.clientId,
    modeloId: visita.modeloId,
    status: visita.status,
    dados: visita.dados,
    token: visita.token,
    capturadoEm: visita.capturadoEm.toISOString(),
    criadoEm: visita.criadoEm?.toISOString() ?? null,
  }
}
