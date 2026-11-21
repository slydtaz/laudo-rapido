/**
 * Allowlist de produção: entra somente o e-mail configurado no servidor.
 * A comparação normaliza espaços e caixa; sem a variável configurada, nenhum
 * e-mail é aceito (fail closed). Nenhum valor é logado.
 */
export function emailPermitido(email: string): boolean {
  const permitido = process.env.EMAIL_PERMITIDO
  if (!permitido) {
    return false
  }
  return email.trim().toLowerCase() === permitido.trim().toLowerCase()
}
