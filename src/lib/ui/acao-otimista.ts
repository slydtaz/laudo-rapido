type AcaoOtimista<T> = {
  /** Muda a interface no mesmo clique, antes de qualquer rede. */
  aplicar: () => T
  /** Trabalho real (fila local, rede, clipboard). */
  executar: () => Promise<unknown>
  /** Recebe o estado devolvido por `aplicar` se a chamada falhar. */
  desfazer?: (estado: T) => void
  aoSucesso?: (resultado: unknown) => void
  aoErro?: (erro: unknown) => void
}

/**
 * Executa a ação e confirma depois. O único ponto de rollback é `desfazer`,
 * então a interface nunca mostra "Carregando…" dentro do botão.
 */
export async function executarOtimista<T>({
  aplicar,
  executar,
  desfazer,
  aoSucesso,
  aoErro,
}: AcaoOtimista<T>): Promise<void> {
  const estado = aplicar()
  try {
    const resultado = await executar()
    aoSucesso?.(resultado)
  } catch (erro) {
    desfazer?.(estado)
    aoErro?.(erro)
  }
}
