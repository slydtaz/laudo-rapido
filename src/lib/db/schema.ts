import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import type { Configuracao } from '../configuracao/modelo'

export const statusVisita = pgEnum('status_visita', [
  'rascunho',
  'sincronizada',
  'entregue',
])

export const empresas = pgTable('empresas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nome: text('nome').notNull(),
  criadoEm: timestamp('criado_em', { mode: 'date' }).defaultNow(),
})

export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id),
  email: text('email').notNull().unique(),
  senhaHash: text('senha_hash'),
  nome: text('nome'),
  googleSub: text('google_sub').unique(),
  emailVerificadoEm: timestamp('email_verificado_em', { mode: 'date' }),
  criadoEm: timestamp('criado_em', { mode: 'date' }).defaultNow(),
})

export const modelosVisita = pgTable('modelos_visita', {
  id: uuid('id').primaryKey().defaultRandom(),
  empresaId: uuid('empresa_id')
    .notNull()
    .references(() => empresas.id),
  nome: text('nome').notNull(),
  campos: jsonb('campos').$type<Record<string, unknown>[]>().notNull(),
})

export const visitas = pgTable(
  'visitas',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    empresaId: uuid('empresa_id')
      .notNull()
      .references(() => empresas.id),
    modeloId: uuid('modelo_id').references(() => modelosVisita.id),
    clientId: uuid('client_id').notNull(),
    status: statusVisita('status').notNull().default('rascunho'),
    dados: jsonb('dados').$type<Record<string, unknown>>().notNull(),
    token: text('token').unique(),
    capturadoEm: timestamp('capturado_em', { mode: 'date' }).notNull(),
    criadoEm: timestamp('criado_em', { mode: 'date' }).defaultNow(),
  },
  (tabela) => [
    // Garante idempotência do envio offline por empresa.
    uniqueIndex('visitas_empresa_id_client_id_unique').on(
      tabela.empresaId,
      tabela.clientId,
    ),
  ],
)

export const fotos = pgTable('fotos', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitaId: uuid('visita_id')
    .notNull()
    .references(() => visitas.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  capturadoEm: timestamp('capturado_em', { mode: 'date' }).notNull(),
})

export const assinaturas = pgTable('assinaturas', {
  id: uuid('id').primaryKey().defaultRandom(),
  visitaId: uuid('visita_id')
    .notNull()
    .unique()
    .references(() => visitas.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  criadoEm: timestamp('criado_em', { mode: 'date' }).defaultNow(),
})

/**
 * Sessões autenticadas. `id` é o token opaco entregue no cookie; sem FKs
 * porque a sessão é uma credencial, não um vínculo relacional do domínio.
 */
export const sessoes = pgTable('sessoes', {
  id: text('id').primaryKey(),
  usuarioId: text('usuario_id').notNull(),
  empresaId: text('empresa_id').notNull(),
  expiraEm: timestamp('expira_em', { mode: 'date' }).notNull(),
  criadoEm: timestamp('criado_em', { mode: 'date' }).defaultNow(),
})

/** Tokens de e-mail: só o hash é persistido e cada um é usado uma vez. */
export const tokensAuth = pgTable('tokens_auth', {
  id: text('id').primaryKey(),
  usuarioId: uuid('usuario_id')
    .notNull()
    .references(() => usuarios.id, { onDelete: 'cascade' }),
  tipo: text('tipo', { enum: ['verificar_email', 'redefinir_senha'] }).notNull(),
  expiraEm: timestamp('expira_em', { mode: 'date' }).notNull(),
  usadoEm: timestamp('usado_em', { mode: 'date' }),
  criadoEm: timestamp('criado_em', { mode: 'date' }).defaultNow(),
})

/**
 * Tentativas por chave opaca (IP + e-mail) dentro de uma janela curta.
 * Sem FKs: é um contador de acesso, não um vínculo do domínio.
 */
export const tentativasLogin = pgTable('tentativas_login', {
  chave: text('chave').primaryKey(),
  tentativas: integer('tentativas').notNull().default(0),
  criadoEm: timestamp('criado_em', { mode: 'date' }).notNull().defaultNow(),
})

/** Configuração editável do aplicativo: uma única linha, `chave = 'app'`. */
export const configuracaoApp = pgTable('configuracao_app', {
  chave: text('chave').primaryKey(),
  valor: jsonb('valor').$type<Configuracao>().notNull(),
  atualizadoEm: timestamp('atualizado_em', { mode: 'date' }).defaultNow(),
})

export type Empresa = typeof empresas.$inferSelect
export type Usuario = typeof usuarios.$inferSelect
export type ModeloVisita = typeof modelosVisita.$inferSelect
export type Visita = typeof visitas.$inferSelect
export type Foto = typeof fotos.$inferSelect
export type Assinatura = typeof assinaturas.$inferSelect
export type SessaoRegistro = typeof sessoes.$inferSelect
export type TokenAuth = typeof tokensAuth.$inferSelect
