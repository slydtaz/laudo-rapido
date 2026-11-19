import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer'
import { createElement as h } from 'react'

import type { Assinatura, Foto, Visita } from '../db/schema'

/**
 * O tsconfig usa `jsx: preserve` para o Next; o Vitest não transforma JSX
 * cru. `createElement` monta a mesma árvore React e funciona nos dois.
 */

/** Visita aceita pelo gerador; mídia e prestador são opcionais. */
export type Laudo = Visita & {
  fotos?: Foto[]
  assinatura?: Assinatura | null
  nomePrestador?: string
}

const estilos = StyleSheet.create({
  pagina: {
    paddingVertical: 40,
    paddingHorizontal: 36,
    fontSize: 10,
    lineHeight: 1.5,
    color: '#1f2937',
  },
  cabecalho: {
    borderBottomWidth: 2,
    borderBottomColor: '#0f766e',
    paddingBottom: 10,
    marginBottom: 18,
  },
  marca: { fontSize: 16, fontWeight: 'bold', color: '#0f766e' },
  titulo: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  secao: { marginTop: 16, marginBottom: 6, fontSize: 12, fontWeight: 'bold' },
  linha: { flexDirection: 'row', marginBottom: 3 },
  rotulo: { width: 110, fontWeight: 'bold' },
  valor: { flex: 1 },
  observacoes: { marginBottom: 6 },
  galeria: { flexDirection: 'row', flexWrap: 'wrap' },
  foto: { width: '30%', height: 120, objectFit: 'cover', marginRight: '2%', marginBottom: 10 },
  assinaturaBloco: { marginTop: 24, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#9ca3af' },
  assinaturaImagem: { width: 180, height: 60, objectFit: 'contain' },
  legenda: { marginTop: 4, color: '#4b5563' },
  rodape: { marginTop: 24, fontSize: 8, color: '#9ca3af' },
})

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) {
    return '—'
  }
  if (typeof valor === 'string') {
    return valor
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor)
  }
  return JSON.stringify(valor)
}

/**
 * RF-05: identificação do prestador. A fonte é o nome da empresa do tenant,
 * carregado pelas rotas de entrega; `dados.empresa` e a marca são fallback.
 */
function nomeEmpresa(visita: Laudo): string {
  const { nomePrestador, dados } = visita
  if (typeof nomePrestador === 'string' && nomePrestador.trim()) {
    return nomePrestador
  }
  const candidato = dados.empresa
  return typeof candidato === 'string' && candidato.trim() ? candidato : 'LaudoRápido'
}

function dadosDoCliente(dados: Record<string, unknown>): [string, string][] {
  return Object.entries(dados)
    .filter(([chave]) => chave !== 'observacoes' && chave !== 'empresa')
    .map(([chave, valor]) => [chave, texto(valor)])
}

function formatarData(data: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(data)
}

function Relatorio({ visita }: { visita: Laudo }) {
  const fotos = visita.fotos ?? []
  const assinatura = visita.assinatura ?? null

  return h(
    Document,
    { title: `Relatório de Visita - ${visita.id}` },
    h(
      Page,
      { size: 'A4', style: estilos.pagina },
      h(
        View,
        { style: estilos.cabecalho },
        h(Text, { style: estilos.marca }, nomeEmpresa(visita)),
        h(Text, { style: estilos.titulo }, 'Relatório de Visita'),
      ),
      h(Text, { style: estilos.secao }, 'Dados do cliente'),
      ...dadosDoCliente(visita.dados).map(([chave, valor]) =>
        h(
          View,
          { style: estilos.linha, key: chave },
          h(Text, { style: estilos.rotulo }, chave),
          h(Text, { style: estilos.valor }, valor),
        ),
      ),
      h(
        View,
        { style: estilos.linha },
        h(Text, { style: estilos.rotulo }, 'Capturado em'),
        h(Text, { style: estilos.valor }, formatarData(visita.capturadoEm)),
      ),
      h(Text, { style: estilos.secao }, 'Observações'),
      // Texto corrido: o react-pdf quebra automaticamente entre páginas.
      h(Text, { style: estilos.observacoes }, texto(visita.dados.observacoes)),
      ...(fotos.length > 0
        ? [
            h(Text, { key: 'titulo-fotos', style: estilos.secao }, 'Fotos'),
            h(
              View,
              { key: 'galeria', style: estilos.galeria },
              ...fotos.map((foto) => h(Image, { key: foto.id, src: foto.url, style: estilos.foto })),
            ),
          ]
        : []),
      ...(assinatura
        ? [
            h(
              View,
              { key: 'assinatura', style: estilos.assinaturaBloco, wrap: false },
              h(Image, { src: assinatura.url, style: estilos.assinaturaImagem }),
              h(Text, { style: estilos.legenda }, `Assinado por ${texto(visita.dados.cliente)}`),
            ),
          ]
        : []),
      h(Text, { style: estilos.rodape, fixed: true }, 'LaudoRápido — laudo de visita técnica'),
    ),
  )
}

/** Renderiza o laudo em bytes PDF, prontos para resposta HTTP ou download. */
export async function gerarPdf(visita: Laudo): Promise<Uint8Array> {
  const buffer = await renderToBuffer(Relatorio({ visita }))
  return new Uint8Array(buffer)
}
