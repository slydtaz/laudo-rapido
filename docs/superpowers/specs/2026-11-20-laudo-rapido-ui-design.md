# LaudoRápido UI Premium — design

**Data:** 2026-11-20

## Intenção

Transformar as quatro telas atuais em uma interface limpa, enxuta e premium, com feedback imediato, sem exigir do usuário nenhum serviço pago. O técnico está em campo, com pressa e frequentemente sem internet: a interface precisa responder no clique e continuar funcionando offline.

## Objetivos

- Tokens de cor, espaçamento e raio centralizados, com tema claro e escuro.
- Cinco idiomas: PT-BR (padrão), English, Español, Français, Deutsch.
- Skeleton animations com `aria-busy` nas áreas que aguardam dados.
- Página 404 personalizada e rota de relatório com skeleton enquanto o PDF é gerado.
- Movimento fluido em CSS, desligado por `prefers-reduced-motion` e pelo ajuste do usuário.
- Botões de ação imediata: o clique executa na hora e a confirmação chega depois por toast, com rollback em falha. Sem "Carregando..." dentro do botão.
- Página de configurações com tema, idioma, movimento, auto-sync e tamanho de texto.
- Página de planos com três tiers e FAQ. Vitrine estática, sem checkout.

## Não objetivos

- Checkout real: o usuário não tem cartão nem conta bancária. Nenhuma integração de pagamento será adicionada.
- Rotas localizadas (`/pt-br`, `/en` etc.): mudariam os links públicos `/o/:token` e o manifesto da PWA.
- Novas dependências de runtime: nada de shadcn/ui, Framer Motion ou lucide-react.
- Mudança de contrato das rotas `/api/v1` ou do comportamento offline.

## Restrições

- Next.js 15, React 19, Tailwind CSS v4, Vitest, Node ≥ 22.
- Todo texto de interface em PT-BR por padrão; os outros idiomas são traduções do mesmo dicionário.
- Testes e smoke existentes localizam controles por rótulo e papel acessível: preservar `role`, `aria-label` e textos dos botões principais.
- `.env.local` e credenciais nunca entram no commit.
- O comando `/impeccable live` não está disponível neste ambiente. A auditoria visual será feita por screenshots no browser em 375, 768, 1280 e 1440 px, claro e escuro.

## Abordagens consideradas

1. **Reforma no cliente (escolhida).** Tema e idioma em variáveis CSS e dicionário no `localStorage`; rotas intactas. Preserva PWA, offline, links públicos e testes. Custo: URLs não ficam traduzidas.
2. **Rotas localizadas.** Melhor SEO e URLs traduzidas, mas exige middleware, reescrita de todos os links e do manifesto, com risco para o link público. Descartada: app de campo não ganha com isso.
3. **Planos com checkout real.** Bloqueado pela ausência de conta bancária. Descartada.

## Decisões de implementação

- Paleta: azul-marinho e teal profundo com acento âmbar; superfícies neutras levemente frias. Tema escuro com superfícies elevadas por luminosidade, não por inversão.
- Fontes: Sora para títulos e DM Sans para texto, via `next/font/google` (self-hosted pelo Next). Sem Inter, Roboto ou system-ui.
- Tema aplicado por `data-theme` no `<html>`, com script inline antes da pintura para evitar flash.
- I18n: dicionário tipado com chaves estáveis; `useT()` lê do provedor; `document.documentElement.lang` acompanha o idioma.
- Skeleton: bloco com shimmer e `aria-busy="true"`, altura reservada para evitar salto de layout.
- Ações otimistas: estado local muda no clique, toast confirma o resultado; falha restaura o estado anterior e mostra erro.
- Configurações persistidas em `localStorage` com uma única chave versionada.
- Planos: Gratuito, Pro e Empresas, com FAQ e CTA que leva ao login. Preços apresentados como referência, sem cobrança.

## Fora do escopo

Câmera física, `beforeinstallprompt`, cache de PDF, i18n de rotas, pagamentos.
