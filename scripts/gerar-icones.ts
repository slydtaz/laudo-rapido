import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

/**
 * Gera os ícones PWA localmente com `sharp` (já dependência do projeto).
 * Ícone de documento em teal — nenhum asset externo ou serviço de imagem.
 * Uso: `corepack pnpm tsx scripts/gerar-icones.ts`
 */

const TEAL = '#0f766e'
const BRANCO = '#ffffff'
const TAMANHOS = [192, 512] as const

function svgIcone(tamanho: number): string {
  const raio = Math.round(tamanho * 0.18)
  const margem = Math.round(tamanho * 0.22)
  const larguraPagina = tamanho - 2 * margem
  const alturaPagina = Math.round(larguraPagina * 1.18)
  const topo = Math.round((tamanho - alturaPagina) / 2)
  const canto = Math.round(tamanho * 0.11)
  const raioPagina = Math.round(tamanho * 0.025)
  const xLinha = margem + Math.round(larguraPagina * 0.16)
  const larguraLinha = Math.round(larguraPagina * 0.68)
  const alturaLinha = Math.max(2, Math.round(tamanho * 0.028))
  const linhas = [0.4, 0.54, 0.68].map(
    (fator) =>
      `<rect x="${xLinha}" y="${topo + Math.round(alturaPagina * fator)}" width="${larguraLinha}" height="${alturaLinha}" rx="${alturaLinha / 2}" fill="${TEAL}"/>`,
  )

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 ${tamanho} ${tamanho}">
  <rect width="${tamanho}" height="${tamanho}" rx="${raio}" fill="${TEAL}"/>
  <rect x="${margem}" y="${topo}" width="${larguraPagina}" height="${alturaPagina}" rx="${raioPagina}" fill="${BRANCO}"/>
  <path d="M ${margem + larguraPagina - canto} ${topo} L ${margem + larguraPagina} ${topo + canto} L ${margem + larguraPagina - canto} ${topo + canto} Z" fill="${TEAL}"/>
  ${linhas.join('\n  ')}
</svg>`
}

async function main(): Promise<void> {
  const destino = path.resolve(process.cwd(), 'public')
  await mkdir(destino, { recursive: true })

  for (const tamanho of TAMANHOS) {
    const png = await sharp(Buffer.from(svgIcone(tamanho))).png().toBuffer()
    const arquivo = path.join(destino, `icon-${tamanho}.png`)
    await writeFile(arquivo, png)
    console.log(`${path.relative(process.cwd(), arquivo)}: ${tamanho}×${tamanho}, ${png.length} bytes`)
  }
}

main().catch((erro) => {
  console.error('Falha ao gerar ícones:', erro)
  process.exit(1)
})
