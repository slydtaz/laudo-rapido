import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

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

export type Empresa = typeof empresas.$inferSelect
export type Usuario = typeof usuarios.$inferSelect
export type ModeloVisita = typeof modelosVisita.$inferSelect
export type Visita = typeof visitas.$inferSelect
export type Foto = typeof fotos.$inferSelect
export type Assinatura = typeof assinaturas.$inferSelect
