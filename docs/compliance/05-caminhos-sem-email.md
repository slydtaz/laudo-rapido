# 05 — Caminhos sem depender de e-mail

**Atualizado em:** 23/11/2026
**Objetivo:** reduzir a papelada sem pedir favor a ninguém. Este documento **não é parecer jurídico**; é triagem técnica com fontes oficiais.
**Regra:** nenhum caminho aqui foi executado. Nenhum plano, região, projeto ou contrato foi alterado.

## Resumo em uma frase

Dá para resolver **quase tudo mudando configuração**, em vez de esperar resposta de suporte. A única exceção é a Vercel, onde a escolha do plano é sua.

## Caminho 1 — Supabase: criar projeto em São Paulo (resolve o pedido de e-mail)

**O que é:** a Supabase oferece a região `sa-east-1` (São Paulo) na lista oficial de regiões específicas. Fonte: https://supabase.com/docs/guides/platform/regions

**O que muda na prática:** o banco passa a ficar no Brasil. Se o dado não sai do Brasil, não há transferência internacional daquele banco — e o pedido de aditivo com cláusulas da ANPD deixa de ser necessário para esse fluxo.

**Atenção (documentação oficial, mesma fonte):**

> "Once you select a region for your project, you cannot change it. If you need to move to a different region, migrate to a new project."

Ou seja: **não tem botão de mudar região**. É preciso criar um projeto novo em `sa-east-1` e migrar. A própria Supabase documenta o caminho: https://supabase.com/docs/guides/platform/migrating-within-supabase

**O que você faz no painel (sem digitar segredo no chat):**

1. Criar novo projeto Supabase e escolher a região **South America (São Paulo), `sa-east-1`**.
2. Rodar as migrations do projeto (`npm run db:migrate`, conforme o `README.md`) no projeto novo.
3. Exportar/importar os dados. A Supabase tem roteiro oficial: **Dashboard → project → backup**; use *Restore to a new project* se disponível, ou o roteiro de backup/restore via CLI.
4. Atualizar as variáveis de ambiente da aplicação com a URL e as chaves do projeto novo. **Nunca cole esses valores no chat.**
5. Conferir que tudo funciona e só depois desativar o projeto antigo.

**Status:** disponível, não executado. Se o projeto novo for em São Paulo, o item "Supabase — aguardando resposta" do dossiê pode ser fechado por mudança de arquitetura. O DPA da Supabase continua arquivado; ele só deixa de ser o mecanismo de transferência para este fluxo.

## Caminho 2 — Cloudflare R2: conferir região (1 minuto, sem e-mail)

Não existe "modo Brasil" documentado para R2. O que existe:

- **Automatic** (padrão): a Cloudflare escolhe a região mais próxima de quem criou o bucket.
- **Location Hints** (`wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`): *best effort*, não garantia, e só valem na criação do bucket.
- **Jurisdictional Restrictions**: garante a jurisdição; os exemplos oficiais são US, EU e FedRAMP — não aparece Brasil.

Fonte: https://developers.cloudflare.com/r2/reference/data-location

**O que você faz:** abrir `dash.cloudflare.com` → **R2 Object Storage** → bucket do LaudoRápido → **Settings → Bucket details** e me dizer só a região mostrada. Se estiver fora do Brasil, a decisão de recriar o bucket em outra região/jurisdição é sua — e a documentação não mostra opção Brasil garantida.

**Status:** depende de uma tela que só você pode abrir.

## Caminho 3 — Make: não precisa de e-mail

O Anexo I das SCCs da Make diz que o uso do serviço equivale a assinar o anexo (*"will be deemed to have signed this Annex I"*). Não há clique nem mensagem pendente.

O que resta é só **guardar evidência** de que a conta está sob contrato com a **Celonis, Inc.** (o DPA da Make fala dessa entidade). Isso se resolve dentro da própria conta Make: **Settings → Plan/Billing** (ou o contrato/Invoice disponível na conta). Se houver um termo ou fatura em nome da Celonis, salve uma cópia em `docs/compliance/contratos/`.

**Status:** nenhuma mensagem precisa ser enviada.

## Caminho 4 — Vercel: aqui não tem "jeito escondido"

Dois fatos oficiais, conferidos em 23/11/2026:

1. O [DPA da Vercel](https://vercel.com/legal/dpa), seção 1, diz: *"This Addendum applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are on Enterprise and Pro plans."* Ou seja, **Hobby fica de fora**.
2. A [documentação do plano Hobby](https://vercel.com/docs/plans/hobby) diz: *"the Hobby plan restricts users to non-commercial, personal use only."*

Não existe configuração de região, cláusula ou painel que mude isso. São duas decisões de negócio:

- **Migrar para Pro** — o DPA publicado passa a cobrir (confirmar por escrito no ato da migração); ou
- **Manter Hobby e registrar a resposta do suporte** — e-mail pronto em `contratos/mensagens-prontas.md`.

**Risco honesto:** se o LaudoRápido passar a cobrar, o uso comercial em Hobby contraria a regra do próprio plano — independente de LGPD. Isso é risco de conta suspensa, não de infração de dados.

**Status:** decisão sua. Não é algo que eu possa configurar no código.

## O que muda no dossiê depois que você agir

| Se você fizer | Item que pode ser fechado | O que ainda depende de você |
|---|---|---|
| Criar Supabase em `sa-east-1` | "Supabase — aguardando resposta" | Atualizar variáveis de ambiente e testar |
| Anotar região do R2 | "Cloudflare — região do bucket" | Nada, se estiver no Brasil; decisão de migrar, se estiver fora |
| Guardar contrato da Make/Celonis | "Make — contrato principal" | Nada |
| Migrar Vercel para Pro | "Vercel Hobby fora do DPA" | Nada |
| Manter Vercel Hobby | Nada | Enviar o e-mail e guardar a resposta |

Depois de qualquer mudança que altere o texto público da política, atualizar `src/lib/legal/conteudo.ts`, `VIGENCIA`, o teste e este dossiê **no mesmo commit**, conforme `AGENTS.md`.

## Fontes oficiais consultadas em 23/11/2026

- Supabase regiões: https://supabase.com/docs/guides/platform/regions
- Supabase migração: https://supabase.com/docs/guides/platform/migrating-within-supabase
- Cloudflare R2 data location: https://developers.cloudflare.com/r2/reference/data-location
- Vercel DPA: https://vercel.com/legal/dpa
- Vercel plano Hobby: https://vercel.com/docs/plans/hobby
- ANPD Res. 19/2024 (art. 16 exige adoção integral das cláusulas-padrão; art. 18 prevê reconhecimento de equivalência, mas não há ato publicado que reconheça as SCCs da UE): https://www.gov.br/anpd/pt-br/acesso-a-informacao/institucional/atos-normativos/regulamentacoes_anpd/resolucao-cd-anpd-no-19-de-23-de-agosto-de-2024
