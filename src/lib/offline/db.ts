import Dexie, { type EntityTable } from 'dexie'

// Import apenas de tipo: evita carregar o Dexie no servidor e o ciclo em runtime.
import type { VisitaLocal } from './queue'

/**
 * Marca de "precisa sincronizar": uma por visita pendente no aparelho.
 * `empresaId` particiona o storage para que um aparelho compartilhado nunca
 * envie a pendência de um tenant sob a sessão de outro (RF-08).
 */
export type PendenciaOffline = {
  clientId: string
  empresaId: string
  criadoEm: Date
}

/** Link `/o/:token` já entregue, guardado para sobreviver a recarregamentos. */
export type EntregaLocal = {
  clientId: string
  empresaId: string
  visitaId: string
  token: string
  criadoEm: Date
}

type FilaOffline = Dexie & {
  visitas: EntityTable<VisitaLocal, 'clientId'>
  pendencias: EntityTable<PendenciaOffline, 'clientId'>
  entregas: EntityTable<EntregaLocal, 'clientId'>
}

/**
 * IndexedDB do aparelho. Visitas são chaveadas por `clientId` (UUIDv4 gerado
 * no cliente) e pendências têm índice por `criadoEm` para envio em ordem.
 * A versão 2 acrescenta `entregas`; a versão 3 adiciona `empresaId` como índice
 * em ambas para isolar tenants num aparelho compartilhado. Linhas legadas sem
 * `empresaId` ficam invisíveis às leituras filtradas (limitação pré-release
 * aceita) — não são apagadas silenciosamente.
 */
export const fila = new Dexie('laudo-rapido-offline') as FilaOffline

fila.version(1).stores({
  visitas: 'clientId',
  pendencias: 'clientId, criadoEm',
})

fila.version(2).stores({
  visitas: 'clientId',
  pendencias: 'clientId, criadoEm',
  entregas: 'clientId, criadoEm',
})

fila.version(3).stores({
  visitas: 'clientId',
  pendencias: 'clientId, empresaId, criadoEm',
  entregas: 'clientId, empresaId, criadoEm',
})
