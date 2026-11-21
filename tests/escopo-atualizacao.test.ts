import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('escopo do aviso de atualização', () => {
  it('monta RegistradorSW só na página de login', () => {
    const layout = readFileSync('src/app/layout.tsx', 'utf8')
    const login = readFileSync('src/app/(publico)/login/page.tsx', 'utf8')

    expect(layout).not.toContain('RegistradorSW')
    expect(login).toContain('<RegistradorSW />')
  })
})
