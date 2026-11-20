import { describe, expect, it, vi } from 'vitest'

import { executarOtimista } from '@/lib/ui/acao-otimista'

describe('ação otimista', () => {
  it('aplica o estado antes de iniciar a chamada', async () => {
    const ordem: string[] = []
    await executarOtimista({
      aplicar: () => {
        ordem.push('otimista')
        return 1
      },
      executar: async () => {
        ordem.push('rede')
      },
    })
    expect(ordem).toEqual(['otimista', 'rede'])
  })

  it('confirma sem desfazer quando a chamada passa', async () => {
    const desfazer = vi.fn()
    const aoSucesso = vi.fn()
    await executarOtimista({
      aplicar: () => 'rascunho',
      executar: async () => undefined,
      desfazer,
      aoSucesso,
    })
    expect(desfazer).not.toHaveBeenCalled()
    expect(aoSucesso).toHaveBeenCalledOnce()
  })

  it('desfaz e avisa quando a chamada falha', async () => {
    const desfazer = vi.fn()
    const aoErro = vi.fn()
    const falha = new Error('sem rede')
    await executarOtimista({
      aplicar: () => 'rascunho',
      executar: async () => {
        throw falha
      },
      desfazer,
      aoErro,
    })
    expect(desfazer).toHaveBeenCalledWith('rascunho')
    expect(aoErro).toHaveBeenCalledWith(falha)
  })
})
