import argon2 from 'argon2'

/** Gera o hash Argon2 da senha com os parâmetros padrão da biblioteca. */
export function hashSenha(senha: string): Promise<string> {
  return argon2.hash(senha)
}

/**
 * Confere a senha em texto puro contra o hash armazenado. Hash inválido ou
 * corrompido conta como senha errada, nunca como erro interno.
 */
export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, senha)
  } catch {
    return false
  }
}
