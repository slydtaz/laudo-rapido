/** Limites usados antes de gravar a visita no aparelho. */

/** Maior lado permitido para cada foto após a redução no cliente. */
export const LADO_MAXIMO_FOTO = 1600

/** Qualidade JPEG usada na redução (bom compromisso entre nitidez e tamanho). */
export const QUALIDADE_JPEG = 0.8

/** Teto do conjunto de mídia que cabe com folga no limite de 4,5 MB da função. */
export const TAMANHO_MAXIMO_MIDIA = 4 * 1024 * 1024

/** Dimensoes que cabem no limite, preservando a proporcao original. */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  limite = LADO_MAXIMO_FOTO,
): { largura: number; altura: number } {
  if (largura <= 0 || altura <= 0) {
    throw new Error('Dimensões de imagem inválidas.')
  }
  const maior = Math.max(largura, altura)
  if (maior <= limite) {
    return { largura, altura }
  }
  const escala = limite / maior
  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  }
}

/** Verdadeiro quando o total de bytes não cabe no limite de envio. */
export function excedeLimite(
  tamanhos: number[],
  limite = TAMANHO_MAXIMO_MIDIA,
): boolean {
  return tamanhos.reduce((total, tamanho) => total + tamanho, 0) > limite
}
