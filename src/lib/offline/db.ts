import Dexie, { type EntityTable } from 'dexie'

// Import apenas de tipo: evita carregar o Dexie no servidor e o ciclo em runtime.
import type { VisitaLocal } from './queue'

/** Marca de "precisa sincronizar": uma por visita pendente no aparelho. */
export type PendenciaOffline = {
  clientId: string
  criadoEm: Date
}

type FilaOffline = Dexie & {
  visitas: EntityTable<VisitaLocal, 'clientId'>
  pendencias: EntityTable<PendenciaOffline, 'clientId'>
}

/**
 * IndexedDB do aparelho. Visitas são chaveadas por `clientId` (UUIDv4 gerado
 * no cliente) e pendências têm índice por `criadoEm` para envio em ordem.
 */
export const fila = new Dexie('laudo-rapido-offline') as FilaOffline

fila.version(1).stores({
  visitas: 'clientId',
  pendencias: 'clientId, criadoEm',
})
