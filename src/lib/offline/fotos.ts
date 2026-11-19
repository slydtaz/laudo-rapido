import { dimensoesReduzidas, QUALIDADE_JPEG } from './imagem'

/**
 * Reduz uma foto no navegador antes de enfileirar: o maior lado fica em até
 * 1600 px e o resultado é JPEG. A data de captura original é preservada pelo
 * chamador — aqui só o bytes da imagem mudam.
 */
export async function reduzirFoto(blob: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') {
    return blob
  }

  const bitmap = await createImageBitmap(blob)
  try {
    const { largura, altura } = dimensoesReduzidas(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = largura
    canvas.height = altura
    const contexto = canvas.getContext('2d')
    if (!contexto) {
      throw new Error('Não foi possível processar a imagem.')
    }
    contexto.drawImage(bitmap, 0, 0, largura, altura)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (resultado) =>
          resultado
            ? resolve(resultado)
            : reject(new Error('Não foi possível comprimir a imagem.')),
        'image/jpeg',
        QUALIDADE_JPEG,
      )
    })
  } finally {
    bitmap.close()
  }
}
