import { eq } from 'drizzle-orm'

import { db } from '../db/client'
import { configuracaoApp } from '../db/schema'
import { configuracaoPadrao, type Configuracao } from './modelo'

const CHAVE_APP = 'app'

/** Configuração atual, ou o objeto padrão quando a única linha não existe. */
export async function lerConfiguracao(): Promise<Configuracao> {
  const [linha] = await db
    .select({ valor: configuracaoApp.valor })
    .from(configuracaoApp)
    .where(eq(configuracaoApp.chave, CHAVE_APP))
    .limit(1)

  return linha?.valor ?? configuracaoPadrao()
}

/** Insere ou substitui a única linha `app` e devolve o que foi persistido. */
export async function salvarConfiguracao(
  configuracao: Configuracao,
): Promise<Configuracao> {
  await db
    .insert(configuracaoApp)
    .values({ chave: CHAVE_APP, valor: configuracao })
    .onConflictDoUpdate({
      target: configuracaoApp.chave,
      set: { valor: configuracao, atualizadoEm: new Date() },
    })

  return configuracao
}
