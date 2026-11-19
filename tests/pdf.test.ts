import { inflateSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'
import { gerarPdf } from '../src/lib/pdf/laudo'
import type { Visita } from '../src/lib/db/schema'

/**
 * O react-pdf comprime os fluxos e desenha o texto como strings hexadecimais
 * (ex.: `<4f666963696e61> TJ`). Decodificamos esses fluxos para inspecionar o
 * texto efetivamente gravado no PDF — sem dependência de extrator externo.
 */
function textoDesenhado(bytes: Uint8Array): string {
  const bruto = Buffer.from(bytes).toString('latin1')
  const fluxos: string[] = []
  const marcador = /stream\r?\n/g
  let correspondencia: RegExpExecArray | null

  while ((correspondencia = marcador.exec(bruto))) {
    const inicio = correspondencia.index + correspondencia[0].length
    const fim = bruto.indexOf('endstream', inicio)
    if (fim === -1) {
      continue
    }
    try {
      fluxos.push(
        inflateSync(Buffer.from(bruto.slice(inicio, fim), 'latin1')).toString('latin1'),
      )
    } catch {
      // Fluxo já sem compressão ou binário: não contém texto desenhado.
    }
  }

  const conteudo = fluxos.join('\n')
  const hexadecimais = conteudo.match(/<[0-9A-Fa-f]+>/g) ?? []
  return hexadecimais
    .map((trecho) => Buffer.from(trecho.slice(1, -1), 'hex').toString('latin1'))
    .join('')
    .replace(/[^A-Za-zÀ-ÿ]/g, '')
}

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

  it('identifica o prestador no cabeçalho quando o nome é informado', async () => {
    const comPrestador = await gerarPdf({ ...visitaFake, nomePrestador: 'Oficina Central' })
    const semPrestador = await gerarPdf(visitaFake)

    expect(textoDesenhado(comPrestador)).toContain('OficinaCentral')
    expect(textoDesenhado(semPrestador)).not.toContain('OficinaCentral')
  })
})
