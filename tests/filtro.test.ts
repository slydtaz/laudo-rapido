import { describe, expect, it } from 'vitest'

import { filtrarVisitas, type VisitaHistorico } from '../src/lib/visita/filtro'

function visita(id: string, cliente: string, tipo: string, observacoes: string, status: string): VisitaHistorico {
  return {
    id,
    token: `token-${id}`,
    status,
    dados: { cliente, tipo, observacoes },
    capturadoEm: '2026-11-20T10:00:00.000Z',
    criadoEm: null,
  }
}

const VISITAS: VisitaHistorico[] = [
  visita('1', 'Padaria Central', 'HVAC', 'Troca de filtro', 'sincronizada'),
  visita('2', 'Hotel Aurora', 'Elétrica', 'Quadro revisado', 'entregue'),
  visita('3', 'Clínica Vida', 'Hidráulica', 'Vazamento HVAC corrigido', 'rascunho'),
]

describe('filtro do histórico', () => {
  it('busca cliente ignorando maiúsculas e espaços', () => {
    expect(filtrarVisitas(VISITAS, '  padaria  ', 'todos').map((item) => item.id)).toEqual(['1'])
  })

  it('busca tipo e observações', () => {
    expect(filtrarVisitas(VISITAS, 'elétrica', 'todos').map((item) => item.id)).toEqual(['2'])
    expect(filtrarVisitas(VISITAS, 'hvac', 'todos').map((item) => item.id)).toEqual(['1', '3'])
  })

  it('filtra por status', () => {
    expect(filtrarVisitas(VISITAS, '', 'entregue').map((item) => item.id)).toEqual(['2'])
    expect(filtrarVisitas(VISITAS, '', 'rascunho').map((item) => item.id)).toEqual(['3'])
  })

  it('combina termo e status sem perder a ordem', () => {
    expect(filtrarVisitas(VISITAS, 'hvac', 'sincronizada').map((item) => item.id)).toEqual(['1'])
    expect(filtrarVisitas(VISITAS, 'hvac', 'entregue')).toEqual([])
  })

  it('devolve todas quando não há termo e status é todos, sem mutar a entrada', () => {
    const copia = [...VISITAS]
    expect(filtrarVisitas(VISITAS, '', 'todos')).toEqual(VISITAS)
    expect(VISITAS).toEqual(copia)
  })
})
