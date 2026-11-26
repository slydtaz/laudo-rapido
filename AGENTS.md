# AGENTS.md — LaudoRápido

## Regra permanente: toda atualização passa pelo crivo de política e lei

Sempre que você alterar **código, texto exibido, documentação, configuração, variáveis de ambiente, infraestrutura, contrato ou fluxo de dados**, pare antes de finalizar e responda a este checklist:

- [ ] A mudança coleta, altera ou expõe dado pessoal (e-mail, nome, IP, foto, assinatura, token, cookie)?
- [ ] Muda finalidade, base legal (LGPD art. 7º), compartilhamento ou operador?
- [ ] Entra operador novo ou passa a processar dados fora do Brasil?
- [ ] Muda retenção, expurgo, exportação ou exclusão?
- [ ] Muda direito do titular, prazo de resposta ou canal de contato?
- [ ] Muda autenticação, sessão, cookie, segurança ou resposta a incidente?
- [ ] Muda texto de privacidade, termos, cookies, planos, preço ou publicidade?
- [ ] Muda cobrança, assinatura digital, PDF com valor de laudo ou perícia?
- [ ] Muda lei, resolução ou norma citada no projeto?

Se **qualquer** resposta for sim:

1. Atualize o texto correspondente em `src/lib/legal/conteudo.ts` **na mesma mudança**.
2. Atualize o dossiê em `docs/compliance/` **na mesma mudança** (ROPA, transferência, enquadramento ou plano de incidente).
3. Atualize `VIGENCIA` em `conteudo.ts` **e** a constante em `tests/paginas-legais.test.tsx` para a data da mudança.
4. Rode `pnpm test` e `pnpm build` antes de concluir.
5. Se a alteração criar obrigação nova que não caiba nos documentos atuais, **pare e avise o dono** — nunca prometa conformidade sem evidência.

## Contexto

- Dossiê de conformidade: `docs/compliance/` — comece pelo `README.md`.
- Controlador, contato e vigência: constantes no topo de `src/lib/legal/conteudo.ts`.
- Nunca inventar CNPJ, endereço postal, encarregado, DPA, cláusula-padrão ou documento que não exista de fato.
- `ctresb/leis` serve apenas para localizar normas. Citação final sempre em Planalto, gov.br/ANPD ou DOU. A redação vigente da LGPD inclui a Lei nº 15.352/2026.

## Limites

Esta é uma regra de processo, não parecer jurídico. Não autoriza publicar, cobrar, assinar instrumento externo nem alterar produção sem decisão do dono.
