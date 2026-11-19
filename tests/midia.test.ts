import { describe, expect, it } from 'vitest'
import { normalizarAssinatura, salvarFoto } from '../src/lib/storage/client'

// PNG 1x1 válido — o payload do plano ('A'.repeat(100)) e o do brief tinham
// IDAT com CRC inválido e não decodificam no sharp; este decodifica.
const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

describe('midia', () => {
  it('normaliza assinatura para PNG', async () => {
    const png = await normalizarAssinatura(PNG_1X1)
    expect(png.byteLength).toBeGreaterThan(0)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
  })

  it('rejeita MIME de foto inválido', async () => {
    await expect(salvarFoto('v-1', Buffer.from('x'), 'application/pdf')).rejects.toThrow()
  })
})
