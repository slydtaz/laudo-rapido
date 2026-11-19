import { describe, expect, it } from 'vitest'
import {
  dimensoesReduzidas,
  excedeLimite,
  LADO_MAXIMO_FOTO,
  TAMANHO_MAXIMO_MIDIA,
} from '../src/lib/offline/imagem'

describe('preparação de mídia no aparelho', () => {
  it('reduz o maior lado preservando a proporção', () => {
    expect(dimensoesReduzidas(4000, 3000)).toEqual({ largura: 1600, altura: 1200 })
    expect(dimensoesReduzidas(3000, 4000)).toEqual({ largura: 1200, altura: 1600 })
    expect(dimensoesReduzidas(800, 600)).toEqual({ largura: 800, altura: 600 })
  })

  it('respeita um limite customizado e rejeita dimensões inválidas', () => {
    expect(dimensoesReduzidas(1000, 500, 500)).toEqual({ largura: 500, altura: 250 })
    expect(() => dimensoesReduzidas(0, 100)).toThrow('Dimensões de imagem inválidas.')
  })

  it('sinaliza quando o total de mídia não cabe no envio', () => {
    expect(excedeLimite([1_000_000, 2_000_000])).toBe(false)
    expect(excedeLimite([3_000_000, 1_500_000])).toBe(true)
    expect(excedeLimite([TAMANHO_MAXIMO_MIDIA])).toBe(false)
    expect(LADO_MAXIMO_FOTO).toBe(1600)
  })
})
