import { defineConfig } from 'drizzle-kit'

// A fonte de verdade das migrações são os arquivos SQL escritos à mão em
// `migrations/`, aplicados em ordem numérica por `criarBancoTeste()`. Por isso
// `db:generate` escreve em `./drizzle` — assim ele nunca sobrescreve nem
// duplica o SQL versionado que o app executa.
export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
})
