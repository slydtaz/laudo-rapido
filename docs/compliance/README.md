# Dossiê de conformidade — LaudoRápido

**Atualizado em:** 23/11/2026
**Controlador:** Artur Fernandes Macêdo Vinhas (pessoa física; ver constantes em `src/lib/legal/conteudo.ts`)
**Canal de privacidade e titular:** `CONTATO` em `src/lib/legal/conteudo.ts`

## Estado das frentes

| # | Frente | Documento | Status |
|---|---|---|---|
| 1 | Transferência internacional | [01-transferencia-internacional.md](./01-transferencia-internacional.md) | **7 documentos baixados** — índice em [contratos/](./contratos/README.md); Make e Cloudflare confirmados; **Vercel Hobby fora do DPA (decisão do dono)**; Supabase aguardando resposta; mensagens prontas em [contratos/mensagens-prontas.md](./contratos/mensagens-prontas.md) |
| 2 | Dispensa de encarregado | [02-enquadramento-pequeno-porte.md](./02-enquadramento-pequeno-porte.md) | **Assinado em 22/11/2026** — [termo](./assinados/2026-11-22-declaracao-pequeno-porte.md) |
| 3 | Registro de operações (art. 37) | [03-ropa-simplificado.md](./03-ropa-simplificado.md) | **Pronto para uso** |
| 4 | Comunicação de incidente (art. 48) | [04-plano-incidente.md](./04-plano-incidente.md) | **Pronto para uso** |
| 5 | Caminhos sem e-mail | [05-caminhos-sem-email.md](./05-caminhos-sem-email.md) | **23/11/2026** — alternativas de configuração (Supabase em SP, região do R2, contrato da Make) e o que é decisão de negócio (Vercel) |

Nenhuma frente apontou infração cometida. O que existe é pendência de evidência documental e de rotina operacional.

## Como usar

1. Leia o documento da frente afetada antes de mexer no código.
2. Aplique o checklist do `AGENTS.md` da raiz do projeto.
3. Se algo mudar, atualize o documento **e** o texto em `src/lib/legal/conteudo.ts` no mesmo commit.
4. Atualize `VIGENCIA` em `conteudo.ts` e a constante em `tests/paginas-legais.test.tsx` com a data da alteração.
5. Rode `pnpm test` e `pnpm build`.

## Fontes oficiais

- LGPD (com alteração da Lei nº 15.352/2026): https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
- Lei nº 15.352/2026: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15352.htm
- CDC: https://www.planalto.gov.br/ccivil_03/leis/l8078compilado.htm
- Marco Civil: https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm
- Lei nº 14.063/2020: https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm
- Res. CD/ANPD nº 2/2022 (pequeno porte): https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-2-de-27-de-janeiro-de-2022
- Res. CD/ANPD nº 15/2024 (incidentes): https://www.in.gov.br/en/web/dou/-/resolucao-cd/anpd-n-15-de-24-de-abril-de-2024-556243024
- Res. CD/ANPD nº 19/2024 (transferência internacional): https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024

## Ressalva

Este dossiê foi montado sem advogado, a pedido expresso do dono, em 22/11/2026. Ele organiza fatos e obrigações conhecidas; não substitui parecer jurídico. Revisão profissional continua recomendada antes de iniciar cobrança, assinar instrumentos com operadores ou tratar o serviço como "já conforme" perante terceiros.
