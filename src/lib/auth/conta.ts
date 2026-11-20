import { eq } from 'drizzle-orm'

import { db } from '../db/client'
import { empresas, sessoes, usuarios } from '../db/schema'
import { enviarLink, type ResultadoEnvio } from './email'
import { hashSenha } from './password'
import {
  consumirToken,
  criarToken,
  podeEmitirToken,
  type TipoToken,
} from './tokens'

const SENHA_CURTA = 'A senha precisa ter pelo menos 8 caracteres.'
const LINK_INVALIDO = 'Link inválido ou expirado.'

export type ResultadoOk = { ok: true; usuarioId: string; envio: ResultadoEnvio }
export type ResultadoErro = { ok: false; erro: string }

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

async function emitirLink(
  usuarioId: string,
  email: string,
  tipo: TipoToken,
): Promise<ResultadoEnvio | null> {
  if (!(await podeEmitirToken(usuarioId, tipo))) {
    return null
  }
  const token = await criarToken(usuarioId, tipo)
  return enviarLink({ tipo, token, email })
}

/** Cria empresa + usuário com senha e dispara o link de verificação. */
export async function criarContaComSenha(input: {
  nome: string
  empresa: string
  email: string
  senha: string
}): Promise<ResultadoOk | ResultadoErro> {
  if (input.senha.length < 8) {
    return { ok: false, erro: SENHA_CURTA }
  }
  const email = normalizarEmail(input.email)

  const [existente] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).limit(1)
  if (existente) {
    return { ok: false, erro: 'E-mail já cadastrado.' }
  }

  const senhaHash = await hashSenha(input.senha)
  const usuarioId = await db.transaction(async (tx) => {
    const [empresa] = await tx
      .insert(empresas)
      .values({ nome: input.empresa.trim() })
      .returning({ id: empresas.id })
    const [usuario] = await tx
      .insert(usuarios)
      .values({
        empresaId: empresa.id,
        email,
        senhaHash,
        nome: input.nome.trim(),
      })
      .returning({ id: usuarios.id })
    return usuario.id
  })

  const envio = await emitirLink(usuarioId, email, 'verificar_email')
  return { ok: true, usuarioId, envio: envio ?? { modo: 'silencioso' } }
}

/** Consome o token de verificação e registra o timestamp de confirmação. */
export async function verificarEmail(
  token: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const usuarioId = await consumirToken(token, 'verificar_email')
  if (!usuarioId) {
    return { ok: false, erro: LINK_INVALIDO }
  }
  await db
    .update(usuarios)
    .set({ emailVerificadoEm: new Date() })
    .where(eq(usuarios.id, usuarioId))
  return { ok: true }
}

/** Emite um novo link de verificação. Nunca revela se a conta existe. */
export async function reenviarVerificacao(email: string): Promise<ResultadoEnvio | null> {
  const [usuario] = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(eq(usuarios.email, normalizarEmail(email)))
    .limit(1)
  if (!usuario) {
    return null
  }
  return emitirLink(usuario.id, usuario.email, 'verificar_email')
}

/** Emite o link de redefinição. Nunca revela se a conta existe. */
export async function solicitarRedefinicao(email: string): Promise<ResultadoEnvio | null> {
  const [usuario] = await db
    .select({ id: usuarios.id, email: usuarios.email })
    .from(usuarios)
    .where(eq(usuarios.email, normalizarEmail(email)))
    .limit(1)
  if (!usuario) {
    return null
  }
  return emitirLink(usuario.id, usuario.email, 'redefinir_senha')
}

/** Troca a senha, consome o token e invalida todas as sessões do usuário. */
export async function redefinirSenha(
  token: string,
  senhaNova: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (senhaNova.length < 8) {
    return { ok: false, erro: SENHA_CURTA }
  }
  const usuarioId = await consumirToken(token, 'redefinir_senha')
  if (!usuarioId) {
    return { ok: false, erro: LINK_INVALIDO }
  }
  await db
    .update(usuarios)
    .set({ senhaHash: await hashSenha(senhaNova) })
    .where(eq(usuarios.id, usuarioId))
  await db.delete(sessoes).where(eq(sessoes.usuarioId, usuarioId))
  return { ok: true }
}
