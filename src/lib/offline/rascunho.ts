/**
 * Estado do formulário de captura. `assinaturaChave` muda a cada visita salva
 * e é usada como `key` do canvas: a remontagem devolve uma área em branco e,
 * pelo efeito de mount do componente, notifica `null` ao pai.
 */
export type RascunhoVisita = {
  cliente: string
  tipo: string
  observacoes: string
  modeloId: string
  fotos: { blob: Blob; capturadoEm: Date; nome: string }[]
  assinatura: Blob | null
  assinaturaChave: number
}

/** Rascunho completamente limpo, sem assinatura e com a chave informada. */
export function rascunhoVazio(assinaturaChave = 0): RascunhoVisita {
  return {
    cliente: '',
    tipo: '',
    observacoes: '',
    modeloId: '',
    fotos: [],
    assinatura: null,
    assinaturaChave,
  }
}

/**
 * Transição "salvou → próxima visita": um objeto novo, sem nenhum campo da
 * visita anterior (inclusive `assinatura`) e com a chave do canvas avançada.
 */
export function proximoRascunho(chaveAtual: number): RascunhoVisita {
  return rascunhoVazio(chaveAtual + 1)
}
