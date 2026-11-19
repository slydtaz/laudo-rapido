import { describe, expect, it } from 'vitest'

import { proximoRascunho, rascunhoVazio } from '../src/lib/offline/rascunho'

describe('reset do rascunho de captura', () => {
  it('rascunhoVazio começa sem assinatura e com chave zero', () => {
    expect(rascunhoVazio()).toEqual({
      cliente: '',
      tipo: '',
      observacoes: '',
      modeloId: '',
      fotos: [],
      assinatura: null,
      assinaturaChave: 0,
    })
  })

  it('proximoRascunho limpa todos os campos e avança a chave do canvas', () => {
    const assinatura = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const anterior = {
      ...rascunhoVazio(7),
      cliente: 'Padaria Central',
      tipo: 'HVAC',
      observacoes: 'Com assinatura',
      modeloId: 'modelo-1',
      fotos: [{ blob: assinatura, capturadoEm: new Date('2026-11-18T10:00:00Z'), nome: 'foto.jpg' }],
      assinatura,
    }

    const proximo = proximoRascunho(anterior.assinaturaChave)

    // Chave diferente => o <AssinaturaCanvas key={...}> remonta em branco e
    // notifica `null`, sem divergir do estado do pai.
    expect(proximo.assinaturaChave).toBe(anterior.assinaturaChave + 1)
    expect(proximo.assinatura).toBeNull()
    expect(proximo.cliente).toBe('')
    expect(proximo.tipo).toBe('')
    expect(proximo.observacoes).toBe('')
    expect(proximo.modeloId).toBe('')
    expect(proximo.fotos).toEqual([])
    // Não altera o rascunho anterior (transição imutável).
    expect(anterior.assinatura).toBe(assinatura)
    expect(anterior.assinaturaChave).toBe(7)
  })
})
