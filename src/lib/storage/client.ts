import { randomUUID } from 'node:crypto'

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import sharp from 'sharp'

/** MIME types aceitos para fotos e a extensão usada na chave do R2. */
export const MIMES_FOTO: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const DATA_URL_BASE64 = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/s

/**
 * Decodifica um data URL (`data:image/png;base64,...`) em Buffer + MIME.
 * Compartilhado pela normalização de assinatura e pelas rotas de upload.
 */
export function extrairDataUrl(dataUrl: string): { mime: string; buffer: Buffer } {
  const correspondencia = DATA_URL_BASE64.exec(dataUrl.trim())
  if (!correspondencia) {
    throw new Error('Imagem inválida: esperado um data URL em base64.')
  }
  return {
    mime: correspondencia[1],
    buffer: Buffer.from(correspondencia[2], 'base64'),
  }
}

/**
 * Cliente R2 construído sob demanda: importar este módulo não exige credenciais
 * e a validação de MIME de `salvarFoto` acontece antes de qualquer acesso a R2.
 */
function clienteR2() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY
  const bucket = process.env.R2_BUCKET

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      'R2 não configurado: defina R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY e R2_BUCKET.',
    )
  }

  return {
    bucket,
    urlPublica: (chave: string) => `https://${bucket}.${accountId}.r2.dev/${chave}`,
    client: new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
  }
}

async function enviar(chave: string, corpo: Buffer, mime: string): Promise<string> {
  const { bucket, urlPublica, client } = clienteR2()
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: chave,
      Body: corpo,
      ContentType: mime,
    }),
  )
  return urlPublica(chave)
}

/**
 * Envia uma foto ao R2 e devolve a URL pública. Formatos fora da lista
 * permitida são rejeitados antes de ler qualquer variável de ambiente.
 */
export async function salvarFoto(visitaId: string, buffer: Buffer, mime: string): Promise<string> {
  if (!Object.hasOwn(MIMES_FOTO, mime)) {
    throw new Error(`Formato de imagem não suportado: ${mime}.`)
  }
  const extensao = MIMES_FOTO[mime]
  const chave = `visitas/${visitaId}/fotos/${randomUUID()}.${extensao}`
  return enviar(chave, buffer, mime)
}

/**
 * Normaliza a assinatura desenhada em canvas (inclusive em DPR alto) para um
 * PNG opaco de no máximo 1200×400, mantendo a proporção original.
 */
export async function normalizarAssinatura(dataUrl: string): Promise<Buffer> {
  const { buffer } = extrairDataUrl(dataUrl)
  return sharp(buffer)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .resize(1200, 400, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
}

/** Envia a assinatura já normalizada ao R2 e devolve a URL pública. */
export async function salvarAssinatura(visitaId: string, png: Buffer): Promise<string> {
  return enviar(`visitas/${visitaId}/assinatura.png`, png, 'image/png')
}
