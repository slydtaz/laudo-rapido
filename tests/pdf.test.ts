import { describe, expect, it } from 'vitest'
import { gerarPdf } from '../src/lib/pdf/laudo'
import type { Visita } from '../src/lib/db/schema'

const visitaFake = {
  id: 'v-1',
  empresaId: 'e-1',
  modeloId: null,
  clientId: '55555555-5555-4555-8555-555555555555',
  status: 'entregue' as const,
  dados: { cliente: 'Padaria Central', tipo: 'HVAC', observacoes: 'Serviço concluído' },
  token: 'token-valido',
  capturadoEm: new Date('2026-11-18T10:00:00Z'),
  criadoEm: new Date('2026-11-18T10:00:00Z'),
} satisfies Visita

describe('PDF', () => {
  it('gera bytes dentro do limite', async () => {
    const bytes = await gerarPdf(visitaFake)
    expect(bytes.byteLength).toBeGreaterThan(1000)
    expect(bytes.byteLength).toBeLessThan(2_000_000)
  })
})
