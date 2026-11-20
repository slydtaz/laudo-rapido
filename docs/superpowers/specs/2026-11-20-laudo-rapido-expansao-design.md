# LaudoRápido Expansão — design

**Data:** 2026-11-20

## Intenção

Ampliar o LaudoRápido sem alterar sua arquitetura: continuar sendo um app de laudo de visita técnica, barato, offline-first e sem cobrança real. A expansão entrega quatro ganhos concretos: preços acessíveis de verdade com camada Enterprise, histórico consultável dos laudos já enviados, resumo do estado local na home e encerramento de sessão.

## Pesquisa de preço (referência externa, 2026)

- Compia (BR): R$ 158 a R$ 198/mês nos planos de SST/laudos.
- Papertrail (UK): £34 por usuário/mês, £17 por técnico.
- Tap Inspect (US): US$ 7 por bloco de 50 laudos; US$ 90/mês ilimitado.

Conclusão: um app que faz **um laudo** não deve custar R$ 49/mês. A vitrine passa a ter quatro faixas: Gratuito R$ 0, Pro R$ 19,90, Equipe R$ 39,90 e Enterprise sob consulta. Nenhuma cobrança é feita nesta versão — os valores são vitrine estática.

## Objetivos

1. Vitrine de planos com 4 faixas, preços baixos, camada Enterprise e textos traduzidos nos 5 idiomas.
2. `/visitas`: histórico dos laudos sincronizados com busca por cliente/tipo e filtro por status.
3. Home com resumo local: pendências de envio e entregas salvas no aparelho.
4. Configurações com "Sair da conta" e rota de logout que apaga cookie e registro da sessão.
5. Tudo com Skeleton, toasts, tema claro/escuro, 5 idiomas e sem dependências novas.

## Restrições

- Rotas preservadas: `/api/v1/*`, `/o/:token`, `/api/health`, `/login`, `/configuracoes`, `/planos`, `/visitas/nova`. Nova rota de página: `/visitas`; nova rota de API: `/api/v1/auth/logout`.
- Rótulos PT-BR usados por testes/smoke não podem mudar.
- PWA/offline preservado: SW v3, rede primeiro em `/_next/static/`, desregistro em dev.
- Sem checkout, cartão, push, merge, deploy ou dependências de runtime novas.
- Preferências em `laudo-rapido:preferencias:v1`.
- Nunca ler, imprimir ou commitar `.env.local`.
