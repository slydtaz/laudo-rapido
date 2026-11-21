import { and, eq, ne } from 'drizzle-orm'

import { db } from '../db/client'
import { empresas, sessoes, usuarios } from '../db/schema'
import { enviarLink, type ResultadoEnvio } from './email'
import { hashSenha, verificarSenha } from './password'
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

/** Contrato único do perfil Google, compartilhado pelo callback e pelo domínio. */
export type PerfilGoogle = {
  sub: string
  email: string
  emailVerificado: boolean
  nome: string
}

export type ResultadoVinculo =
  | { ok: true; usuarioId: string }
  | {
      ok: false
      erro: string
      codigo: 'EMAIL_NAO_VERIFICADO' | 'CONTA_LOCAL_NAO_VERIFICADA' | 'SUB_DIVERGENTE'
    }

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** O driver expõe `code` direto; o Drizzle embrulha o erro em `cause`. */
function eConflitoDeUnicidade(erro: unknown): boolean {
  let atual: unknown = erro
  const vistos = new Set<unknown>()
  while (typeof atual === 'object' && atual !== null && !vistos.has(atual)) {
    vistos.add(atual)
    if ('code' in atual && atual.code === '23505') {
      return true
    }
    atual = 'cause' in atual ? atual.cause : undefined
  }
  return false
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
  let usuarioId: string
  try {
    usuarioId = await db.transaction(async (tx) => {
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
  } catch (erro) {
    // Duas submissões simultâneas podem passar pelo SELECT acima; a constraint
    // de unicidade decide e o erro ganha a mesma resposta do e-mail duplicado.
    if (eConflitoDeUnicidade(erro)) {
      return { ok: false, erro: 'E-mail já cadastrado.' }
    }
    throw erro
  }

  const envio = await emitirLink(usuarioId, email, 'verificar_email')
  return { ok: true, usuarioId, envio: envio ?? { modo: 'silencioso' } }
}

/** Consome o token de verificação e registra o timestamp de confirmação. */
export async function verificarEmail(
  token: string,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  const usuarioId = await db.transaction(async (tx) => {
    const id = await consumirToken(token, 'verificar_email', tx)
    if (!id) {
      return null
    }
    await tx
      .update(usuarios)
      .set({ emailVerificadoEm: new Date() })
      .where(eq(usuarios.id, id))
    return id
  })
  if (!usuarioId) {
    return { ok: false, erro: LINK_INVALIDO }
  }
  return { ok: true }
}

/** Emite um novo link de verificação. Nunca revela se a conta existe. */
export async function reenviarVerificacao(email: string): Promise<ResultadoEnvio | null> {
  const [usuario] = await db
    .select({ id: usuarios.id, email: usuarios.email })
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
  // Hash antes da transação: um erro de Argon2 não pode queimar o token.
  const senhaHash = await hashSenha(senhaNova)
  const usuarioId = await db.transaction(async (tx) => {
    const id = await consumirToken(token, 'redefinir_senha', tx)
    if (!id) {
      return null
    }
    await tx.update(usuarios).set({ senhaHash }).where(eq(usuarios.id, id))
    await tx.delete(sessoes).where(eq(sessoes.usuarioId, id))
    return id
  })
  if (!usuarioId) {
    return { ok: false, erro: LINK_INVALIDO }
  }
  return { ok: true }
}

/**
 * Só vincula quando Google e a conta local atestam o e-mail. Conta local
 * existente e não verificada nunca é vinculada nem marcada como verificada.
 */
export async function vincularOuCriarGoogle(perfil: PerfilGoogle): Promise<ResultadoVinculo> {
  if (!perfil.emailVerificado) {
    return {
      ok: false,
      codigo: 'EMAIL_NAO_VERIFICADO',
      erro: 'O Google não confirmou este e-mail.',
    }
  }
  const email = normalizarEmail(perfil.email)
  const [existente] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1)

  if (!existente) {
    const usuarioId = await db.transaction(async (tx) => {
      const [empresa] = await tx
        .insert(empresas)
        .values({ nome: 'Minha empresa' })
        .returning({ id: empresas.id })
      const [usuario] = await tx
        .insert(usuarios)
        .values({
          empresaId: empresa.id,
          email,
          nome: perfil.nome,
          googleSub: perfil.sub,
          emailVerificadoEm: new Date(),
          senhaHash: null,
        })
        .returning({ id: usuarios.id })
      return usuario.id
    })
    return { ok: true, usuarioId }
  }

  if (!existente.emailVerificadoEm) {
    return {
      ok: false,
      codigo: 'CONTA_LOCAL_NAO_VERIFICADA',
      erro: 'Entre com sua senha, verifique o e-mail e tente novamente.',
    }
  }
  if (existente.googleSub && existente.googleSub !== perfil.sub) {
    return {
      ok: false,
      codigo: 'SUB_DIVERGENTE',
      erro: 'Esta conta já está vinculada a outro perfil do Google.',
    }
  }
  await db
    .update(usuarios)
    .set({
      googleSub: perfil.sub,
      nome: existente.nome ?? perfil.nome,
    })
    .where(eq(usuarios.id, existente.id))
  return { ok: true, usuarioId: existente.id }
}

/** Dados não sensíveis exibidos em `/conta`. */
export type Perfil = {
  nome: string
  email: string
  empresa: string
  verificado: boolean
  provedor: 'senha' | 'google'
  criadoEm: string
}

export async function lerPerfil(usuarioId: string): Promise<Perfil | null> {
  const [linha] = await db
    .select({
      nome: usuarios.nome,
      email: usuarios.email,
      empresa: empresas.nome,
      verificadoEm: usuarios.emailVerificadoEm,
      senhaHash: usuarios.senhaHash,
      criadoEm: usuarios.criadoEm,
    })
    .from(usuarios)
    .innerJoin(empresas, eq(usuarios.empresaId, empresas.id))
    .where(eq(usuarios.id, usuarioId))
    .limit(1)

  if (!linha) {
    return null
  }
  return {
    nome: linha.nome ?? '',
    email: linha.email,
    empresa: linha.empresa,
    verificado: linha.verificadoEm !== null,
    provedor: linha.senhaHash ? 'senha' : 'google',
    criadoEm: (linha.criadoEm ?? new Date()).toISOString(),
  }
}

/** Atualiza o nome exibido do técnico e da empresa. */
export async function atualizarNome(
  usuarioId: string,
  nome: string,
  empresaNome: string,
): Promise<void> {
  const [usuario] = await db
    .select({ empresaId: usuarios.empresaId })
    .from(usuarios)
    .where(eq(usuarios.id, usuarioId))
    .limit(1)
  if (!usuario) {
    return
  }
  await db.update(usuarios).set({ nome }).where(eq(usuarios.id, usuarioId))
  await db.update(empresas).set({ nome: empresaNome }).where(eq(empresas.id, usuario.empresaId))
}

/**
 * Conta com senha exige a senha atual; conta Google exige e-mail verificado.
 * Todas as outras sessões são invalidadas, mantendo apenas a atual.
 */
export async function trocarSenha(
  usuarioId: string,
  senhaAtual: string | null,
  senhaNova: string,
  tokenAtual: string | null,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (senhaNova.length < 8) {
    return { ok: false, erro: SENHA_CURTA }
  }
  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, usuarioId)).limit(1)
  if (!usuario) {
    return { ok: false, erro: 'Conta não encontrada.' }
  }
  if (usuario.senhaHash) {
    if (!senhaAtual || !(await verificarSenha(senhaAtual, usuario.senhaHash))) {
      return { ok: false, erro: 'Senha atual incorreta.' }
    }
  } else if (!usuario.emailVerificadoEm) {
    return { ok: false, erro: 'Verifique seu e-mail antes de criar uma senha.' }
  }

  await db
    .update(usuarios)
    .set({ senhaHash: await hashSenha(senhaNova) })
    .where(eq(usuarios.id, usuarioId))
  await db
    .delete(sessoes)
    .where(and(eq(sessoes.usuarioId, usuarioId), ne(sessoes.id, tokenAtual ?? '')))
  return { ok: true }
}
