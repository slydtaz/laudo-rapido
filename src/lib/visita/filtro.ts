/** Filtro puro do histórico: usado pela tela e testado sem browser. */

export type StatusHistorico = 'todos' | 'rascunho' | 'sincronizada' | 'entregue'

/** Formato serializado devolvido por `GET /api/v1/visitas`. */
export type VisitaHistorico = {
  id: string
  token: string
  status: string
  dados: Record<string, unknown>
  capturadoEm: string
  criadoEm?: string | null
}

function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor : ''
}

function normalizar(valor: string): string {
  return valor.trim().toLocaleLowerCase('pt-BR')
}

/**
 * Filtra por status e por termo em cliente, tipo e observações.
 * Não altera a lista recebida e preserva a ordem original.
 */
export function filtrarVisitas(
  visitas: VisitaHistorico[],
  termo: string,
  status: StatusHistorico,
): VisitaHistorico[] {
  const busca = normalizar(termo)

  return visitas.filter((visita) => {
    if (status !== 'todos' && visita.status !== status) {
      return false
    }
    if (!busca) {
      return true
    }

    return [
      texto(visita.dados?.cliente),
      texto(visita.dados?.tipo),
      texto(visita.dados?.observacoes),
    ].some((campo) => normalizar(campo).includes(busca))
  })
}
