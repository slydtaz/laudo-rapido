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
 * Cliente de storage construído sob demanda: importar este módulo não exige
 * credenciais e a validação de MIME de `salvarFoto` acontece antes de qualquer
 * acesso ao storage. O R2 é o padrão; os overrides permitem qualquer storage
 * S3-compatible (ex.: Supabase Storage) sem ramificação por provedor.
 */
function clienteR2() {
  const accountId = (process.env.R2_ACCOUNT_ID || '').trim()
  const accessKeyId = (process.env.R2_ACCESS_KEY_ID || '').trim()
  const secretAccessKey = (process.env.R2_SECRET_ACCESS_KEY || '').trim()
  const bucket = (process.env.R2_BUCKET || '').trim()
  const overrideEndpoint = (process.env.R2_ENDPOINT || '').trim()
  const overridePublico = (process.env.R2_PUBLIC_BASE || '').trim()

  const endpoint =
    overrideEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '')
  // Com endpoint customizado, a base pública deve ser explícita: derivá-la do
  // accountId do R2 geraria uma URL que não existe no provedor escolhido.
  const basePublica =
    overridePublico || (!overrideEndpoint && accountId ? `https://${bucket}.${accountId}.r2.dev` : '')

  if (!accessKeyId || !secretAccessKey || !bucket || !endpoint || !basePublica) {
    throw new Error(
      'Storage não configurado: defina R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_ACCOUNT_ID (ou R2_ENDPOINT + R2_PUBLIC_BASE).',
    )
  }

  const urlEndpoint = new URL(endpoint)
  if (urlEndpoint.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(urlEndpoint.hostname)) {
    throw new Error('Storage: R2_ENDPOINT deve usar HTTPS (exceto localhost em desenvolvimento).')
  }

  const forcarPathStyle = /^(1|true|yes)$/i.test((process.env.R2_FORCE_PATH_STYLE || '').trim())

  return {
    bucket,
    urlPublica: (chave: string) => `${basePublica.replace(/\/+$/, '')}/${chave}`,
    client: new S3Client({
      region: (process.env.R2_REGION || '').trim() || 'auto',
      endpoint,
      forcePathStyle: forcarPathStyle,
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
 * Envia uma foto ao storage e devolve a URL pública. Formatos fora da lista
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

/** Envia a assinatura já normalizada ao storage e devolve a URL pública. */
export async function salvarAssinatura(visitaId: string, png: Buffer): Promise<string> {
  return enviar(`visitas/${visitaId}/assinatura.png`, png, 'image/png')
}
