# Atualização apenas no login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manter o aviso/botão "Atualizar" somente em `/login`, com card de alerta visível para todos e clique que recarrega de forma confiável, sem alterar o gate server-side.

**Architecture:** O service worker deixa de se ativar sozinho no `install` e passa a esperar `SKIP_WAITING`; `RegistradorSW` recarrega quando o worker ativa ou quando o controle muda, e deixa de ser montado no layout raiz. O card de alerta é um componente visual em `FormularioLogin`, com textos nas cinco idiomas; a autorização continua exclusivamente no servidor.

**Tech Stack:** Next.js 15 (App Router), React, TypeScript, Tailwind-like CSS do projeto, Vitest + Testing Library, service worker vanilla.

**Spec:** `docs/superpowers/specs/2026-11-21-laudo-rapido-atualizacao-login-design.md`

## Global Constraints

- Gate server-side intacto: `EMAIL_PERMITIDO=macedoartur1250@gmail.com`, `exigirAcesso()` com `trim().toLowerCase()`, fail closed se ausente. Sem JWT e sem autorização no front-end.
- Callback Google exato: `https://laudo-rapido.vercel.app/api/v1/auth/google/callback`. Não alterar OAuth, JWKS, PKCE ou escopo.
- Preços honestos: Gratuito `R$ 0`, Pro `R$ 29,90`, Equipe `R$ 79,90` (condição futura), Enterprise `Sob consulta`. Sem cobrança, checkout ou webhook de pagamento.
- PT-BR é a versão legal autoritativa. Toda chave i18n nova existe em `ptBR`, `en`, `es`, `fr`, `de`.
- Sem banner de cookies, rastreadores ou novos cookies. Nenhuma credencial, token ou segredo em chat, log, commit ou mensagem de erro.
- Rótulos preservados: `Entrar`, `Registrar nova visita`, `Salvar visita no aparelho`, `Sincronizar agora`, `Copiar link`, `Baixar PDF`.
- `git add` explícito por caminho; nunca `git commit -am`. Sem push, merge ou `vercel --prod` até confirmação explícita final do dono.
- Suíte confiável: `corepack pnpm vitest run --maxWorkers=4`. Não alterar `vitest.config.ts`.
- Worktree: `STARTUPS/startup-inicial/.worktrees/laudo-rapido-mvp`. Respostas em PT-BR, curtas.

## Review Focus

- Clique sem efeito quando `controllerchange` já ocorreu antes do aceite → teste de recarga por `worker.state === 'activated'` na Task 2.
- Botão aparecendo em páginas públicas/legais → teste de escopo do componente na Task 2 e smoke pós-deploy.
- Não-autorizado entrando por causa do card/front-end → gate intacto, testes existentes de 401/403/redirect e smoke de APIs protegidas.
- Chave i18n faltando em algum idioma → `DicionarioTextos` força as cinco chaves; teste explícito em `IDIOMAS_TEXTOS` na Task 3.
- Versão antiga do SW servindo chunks após deploy → bump para `laudo-rapido-v5` e teste de purga/install na Task 1.

---

### Task 1: Service worker espera o clique

**Files:**
- Modify: `public/sw.js:1-36`
- Test: `tests/service-worker.test.ts`

**Interfaces:**
- Consumes: manipulador `message` existente com `{ type: 'SKIP_WAITING' }`.
- Produces: SW `laudo-rapido-v5`; `install` não chama `skipWaiting`; ativação só por mensagem do cliente.

- [ ] **Step 1: Write the failing test**

Adicionar ao final de `tests/service-worker.test.ts`, dentro do `describe` existente:

```ts
  it('não ativa sozinho no install; espera SKIP_WAITING do cliente', async () => {
    const { manipuladores, self } = carregarServiceWorker({
      buscar: vi.fn(async () => new RespostaFalsa('')),
    })

    let conclusao: Promise<unknown> | undefined
    manipuladores.install?.({
      waitUntil: (promessa) => {
        conclusao = promessa
      },
    })
    await conclusao

    expect(self.skipWaiting).not.toHaveBeenCalled()

    const waitUntil = vi.fn()
    manipuladores.message?.({ data: { type: 'SKIP_WAITING' }, waitUntil })
    expect(self.skipWaiting).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/service-worker.test.ts --maxWorkers=1`
Expected: FAIL em `expect(self.skipWaiting).not.toHaveBeenCalled()` — o `install` chama `skipWaiting()` hoje.

- [ ] **Step 3: Implement em `public/sw.js`**

Mudar `const VERSAO = 'laudo-rapido-v4'` para `const VERSAO = 'laudo-rapido-v5'`; atualizar o comentário da linha 11 para v5 removendo v4. No handler de `install`, remover `.then(() => self.skipWaiting())`, deixando `cache.addAll(SHELL)` como última etapa do `waitUntil`. Não tocar no `activate` (`clients.claim()` fica) nem no handler de `message`.

- [ ] **Step 4: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/service-worker.test.ts --maxWorkers=1`
Expected: PASS, incluindo o teste existente "aplica SKIP_WAITING ao receber a mensagem do cliente".

- [ ] **Step 5: Commit**

```bash
git add public/sw.js tests/service-worker.test.ts docs/superpowers/specs/2026-11-21-laudo-rapido-atualizacao-login-design.md docs/superpowers/plans/2026-11-21-laudo-rapido-atualizacao-login.md
git commit -m "fix(pwa): ativa service worker so apos confirmacao"
```

### Task 2: Recarga confiável e botão só no login

**Files:**
- Modify: `src/components/RegistradorSW.tsx:63-68`
- Modify: `src/app/layout.tsx:6,75`
- Modify: `src/app/(publico)/login/page.tsx:1,30`
- Test: `tests/atualizacao-pwa.test.tsx`
- Create: `tests/escopo-atualizacao.test.ts`

**Interfaces:**
- Consumes: `RegistradorSW` (cliente) com `useToast`, `useT`, refs `workerRef`, `aceitouAtualizacaoRef`, `recarregadoRef`.
- Produces: `<RegistradorSW />` montado apenas na página `/login`; recarga única por `activated` ou `controllerchange`.

- [ ] **Step 1: Write the failing tests**

Adicionar em `tests/atualizacao-pwa.test.tsx`, dentro do `describe` existente:

```tsx
  it('recarrega quando o worker ativa após o aceite, mesmo sem controllerchange', async () => {
    renderRegistrador()

    await waitFor(() => {
      expect(mock.register).toHaveBeenCalledWith('/sw.js', { updateViaCache: 'none' })
    })

    mock.dispararRegistro('updatefound')
    mock.worker.state = 'installed'
    mock.dispararWorker('statechange')

    expect(await screen.findByText('Nova versão disponível')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar' }))
    mock.worker.state = 'activated'
    mock.dispararWorker('statechange')

    expect(reload).toHaveBeenCalledTimes(1)

    mock.dispararSW('controllerchange')
    expect(reload).toHaveBeenCalledTimes(1)
  })
```

Criar `tests/escopo-atualizacao.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `corepack pnpm vitest run tests/atualizacao-pwa.test.tsx tests/escopo-atualizacao.test.ts --maxWorkers=1`
Expected: FAIL no reload por `activated` (guard `workerRef.current` impede) e no escopo (layout ainda importa o componente).

- [ ] **Step 3: Implement em `src/components/RegistradorSW.tsx`**

Substituir o corpo de `aoStateChange` por:

```ts
    const aoStateChange = () => {
      if (cancelado || !worker) return

      if (!workerRef.current && worker.state === 'installed') {
        workerRef.current = worker
        avisarRef.current(mensagemRef.current, 'info')
        setMostrarAtualizar(true)
        return
      }

      if (
        workerRef.current === worker &&
        worker.state === 'activated' &&
        aceitouAtualizacaoRef.current &&
        !recarregadoRef.current
      ) {
        recarregadoRef.current = true
        location.reload()
      }
    }
```

Manter `aoControllerChange`, `aoUpdateFound`, o efeito e o JSX do botão exatamente como estão.

- [ ] **Step 4: Mover a montagem para `/login`**

Em `src/app/layout.tsx`: remover `import RegistradorSW from '@/components/RegistradorSW'` e a linha `<RegistradorSW />` dentro de `ToastProvider`.

Em `src/app/(publico)/login/page.tsx`: adicionar `import RegistradorSW from '@/components/RegistradorSW'` após o import de `FormularioLogin` e trocar `return <FormularioLogin />` por:

```tsx
  return (
    <>
      <RegistradorSW />
      <FormularioLogin />
    </>
  )
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `corepack pnpm vitest run tests/atualizacao-pwa.test.tsx tests/escopo-atualizacao.test.ts --maxWorkers=1`
Expected: PASS nos três cenários, incluindo "não recarrega com controllerchange anterior ao aceite do usuário".

- [ ] **Step 6: Commit**

```bash
git add src/components/RegistradorSW.tsx src/app/layout.tsx 'src/app/(publico)/login/page.tsx' tests/atualizacao-pwa.test.tsx tests/escopo-atualizacao.test.ts
git commit -m "fix(pwa): mostra atualizacao so no login e recarrega ao ativar"
```

### Task 3: Card de alerta no login

**Files:**
- Modify: `src/app/(publico)/login/FormularioLogin.tsx:77-81`
- Modify: `src/lib/i18n/dicionario.ts` (blocos `ptBR`, `en`, `es`, `fr`, `de`)
- Test: `tests/login-alerta.test.tsx`

**Interfaces:**
- Consumes: `useT()` de `@/lib/i18n/useT`; `IDIOMAS_TEXTOS` de `@/lib/i18n/dicionario`.
- Produces: chaves `loginAvisoManutencaoTitulo` e `loginAvisoManutencaoTexto` disponíveis nos cinco idiomas; `<aside role="status">` no login.

- [ ] **Step 1: Write the failing test**

Criar `tests/login-alerta.test.tsx`:

```tsx
// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { describe, expect, it, vi } from 'vitest'

import FormularioLogin from '@/app/(publico)/login/FormularioLogin'
import ProvedorPreferencias from '@/components/ProvedorPreferencias'
import ToastProvider from '@/components/ToastProvider'
import { IDIOMAS_TEXTOS } from '@/lib/i18n/dicionario'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

describe('card de alerta do login', () => {
  it('mostra aviso de acesso restrito para todos', () => {
    render(
      createElement(
        ProvedorPreferencias,
        null,
        createElement(ToastProvider, null, createElement(FormularioLogin)),
      ),
    )

    const alerta = screen.getByRole('status')
    expect(alerta.textContent).toContain('Área em preparação')
    expect(alerta.textContent).toContain(
      'Acesso restrito ao responsável. Outras contas são bloqueadas automaticamente.',
    )
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy()
  })

  it('tem as duas chaves nos cinco idiomas', () => {
    for (const idioma of ['ptBR', 'en', 'es', 'fr', 'de'] as const) {
      expect(IDIOMAS_TEXTOS[idioma].loginAvisoManutencaoTitulo.length).toBeGreaterThan(0)
      expect(IDIOMAS_TEXTOS[idioma].loginAvisoManutencaoTexto.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `corepack pnpm vitest run tests/login-alerta.test.tsx --maxWorkers=1`
Expected: FAIL — `getByRole('status')` não encontra o card e as chaves não existem.

- [ ] **Step 3: Add i18n keys**

Em `src/lib/i18n/dicionario.ts`, acrescentar as duas chaves em cada bloco, ao lado das chaves `loginAvisoLegal`:

- `ptBR`: `'Área em preparação'` / `'Acesso restrito ao responsável. Outras contas são bloqueadas automaticamente.'`
- `en`: `'Area under preparation'` / `'Access is restricted to the owner. Other accounts are blocked automatically.'`
- `es`: `'Área en preparación'` / `'El acceso está restringido al responsable. Otras cuentas se bloquean automáticamente.'`
- `fr`: `"Espace en préparation"` / `"L'accès est réservé au responsable. Les autres comptes sont bloqués automatiquement."`
- `de`: `'Bereich in Vorbereitung'` / `'Der Zugang ist auf die verantwortliche Person beschränkt. Andere Konten werden automatisch blockiert.'`

Não alterar nenhuma outra chave nem o corpo dos documentos legais.

- [ ] **Step 4: Add the card**

Em `src/app/(publico)/login/FormularioLogin.tsx`, logo após o `<p>` de `t('loginSubtitulo')` e antes do `<form>`:

```tsx
        <aside role="status" className="card mt-4 p-4 text-sm">
          <p className="font-semibold">{t('loginAvisoManutencaoTitulo')}</p>
          <p className="mt-1 text-muted">{t('loginAvisoManutencaoTexto')}</p>
        </aside>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `corepack pnpm vitest run tests/login-alerta.test.tsx --maxWorkers=1`
Expected: PASS nos dois testes.

- [ ] **Step 6: Commit**

```bash
git add 'src/app/(publico)/login/FormularioLogin.tsx' src/lib/i18n/dicionario.ts tests/login-alerta.test.tsx
git commit -m "feat(login): adiciona card de alerta de acesso restrito"
```

### Task 4: Suíte completa e build

**Files:**
- Nenhum arquivo de código; verificação final.

**Interfaces:**
- Consumes: Task 1, Task 2 e Task 3 commitadas.
- Produces: evidência de testes e build para o pedido de deploy.

- [ ] **Step 1: Run full suite**

Run: `corepack pnpm vitest run --maxWorkers=4`
Expected: todos os arquivos e testes PASS, sem alterar `vitest.config.ts`.

- [ ] **Step 2: Run production build**

Run: `corepack pnpm build`
Expected: exit 0 e 38/38 páginas geradas.

- [ ] **Step 3: Check working tree**

Run: `git status --short`
Expected: apenas `?? graphify-out/` (intacto e fora do git). Nenhum segredo, `.env*` ou `.vercel` rastreado.

- [ ] **Step 4: Handoff**

Pedir confirmação explícita do dono antes de `vercel --prod`. Após confirmação: deploy e smoke em `/login`, `/privacidade`, `/termos`, `/cookies`, `/api/health`, `/planos` (307 sem sessão) e APIs protegidas (403 sem sessão). Nunca fazer push/merge sem pedido separado.
