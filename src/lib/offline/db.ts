import Dexie, { type EntityTable } from 'dexie'

// Import apenas de tipo: evita carregar o Dexie no servidor e o ciclo em runtime.
import type { VisitaLocal } from './queue'

/** Marca de "precisa sincronizar": uma por visita pendente no aparelho. */
export type PendenciaOffline = {
  clientId: string
  criadoEm: Date
}

/** Link `/o/:token` já entregue, guardado para sobreviver a recarregamentos. */
export type EntregaLocal = {
  clientId: string
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
 * A versão 2 acrescenta `entregas` para os links públicos de entrega.
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
