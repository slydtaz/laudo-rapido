import { db } from '../src/lib/db/client'
import { aplicarMigracoes } from '../src/lib/db/migrar'

async function main() {
  await aplicarMigracoes(db)
  console.log('Migrações aplicadas com sucesso.')
  process.exit(0)
}

main().catch((erro) => {
  console.error('Falha ao aplicar migrações:', erro)
  process.exit(1)
})
