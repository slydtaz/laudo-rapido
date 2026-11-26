# Índice dos contratos de operadores

**Finalidade:** registrar os documentos de tratamento e transferência internacional recebidos dos operadores do LaudoRápido.
**Atualizado em:** 23/11/2026.

**Estado em 23/11/2026:** 7 arquivos públicos baixados em 22/11/2026, conferidos quanto ao formato (PDF válido ou HTML da página oficial) e, no caso da Make e da Cloudflare, lidos diretamente para confirmar o mecanismo. Nenhum documento foi assinado por você e nenhum mecanismo foi aceito como suficiente — os status abaixo são honestos. Mensagens para copiar e roteiro do painel: [mensagens-prontas.md](./mensagens-prontas.md).

| Operador | Arquivo(s) | Baixado em | País declarado | Mecanismo declarado | Status |
|---|---|---|---|---|---|
| **Google (Gmail pessoal)** | `google-privacidade.html`, `google-termos.html` | 22/11/2026 | Servidores ao redor do mundo (a Política não fixa um país) | **Não há DPA.** A Google não atua como operadora na versão consumidor; valem os Termos de Serviço e a Política de Privacidade | **Documentado — sem DPA aplicável** |
| **Make** (webhook de e-mail) | `email-dpa.pdf`, `make-scc.pdf` | 22/11/2026 | Celonis, Inc. (registrada no DPF EUA-UE); endereço e contato exatos remetidos ao contrato principal | DPA Celonis v05/2024, cláusula 7.1 lida em 23/11/2026: **DPF é o mecanismo primário**; se invalidado, SCCs da UE, Módulo Dois (Controlador→Operador), com Celonis Inc. como importadora | **Arquivado — mecanismo lido; contrato principal a confirmar** |
| **Cloudflare R2** | `cloudflare-dpa.pdf` | 22/11/2026 | **EUA** — Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107 (Anexo 1, conferido em 23/11/2026) | DPA v6.4; DPF (cláusula 6.4), SCCs da UE (cláusula 6.2) e Global PRP System (seção 7) | **Arquivado — região do bucket a ver em Settings → Bucket details** |
| **Vercel** | `vercel-dpa.html` | 22/11/2026 | Vercel Inc. (Delaware), EUA | DPA vigente desde 31/03/2026, **mas a seção 1 limita-o a planos Enterprise e Pro** | **Sem DPA aplicável no plano Hobby — decisão do dono** |
| **Supabase** (Postgres) | `supabase-dpa.html` | 22/11/2026 | Singapura (Supabase Pte. Ltd, 65 Chulia Street, OCBC Centre) | DPA v1 de 01/08/2026 + SCCs da UE (Módulo Dois). A cláusula 12.4 prevê aditivo incorporando mecanismo formal adotado pelo país do exportador | **Arquivado — mecanismo alternativo a conferir** |

## Formato dos arquivos

- `.pdf` — documento baixado diretamente do operador; conferido o cabeçalho `%PDF` na data do download e o fim `%%EOF`.
- `.html` — página oficial vigente na data do download, salva para registrar a versão. Não é conversão nem resumo.
- Não foi salvo o CDPA da Google porque ele **não se aplica** a Gmail pessoal (ver abaixo).

## Achados que mudaram o planejamento

1. **Google é Gmail pessoal.** A Central de Ajuda da Google afirma: *"Google doesn't offer a Data Processing Agreement for the consumer versions of Gmail or Drive. Google does not act as a data processor for the consumer version of these services."* A Google é controladora independente na relação com o usuário; o LaudoRápido **recebe** nome/e-mail/`sub` mediante autorização do usuário, e não envia dados pessoais à Google como operadora. Não há DPA a pedir. Fonte: https://support.google.com/legal-help-center/answer/13885940?hl=en
2. **Vercel é plano Hobby — e o DPA público não cobre Hobby.** A seção 1 diz literalmente: *"This Addendum applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are on Enterprise and Pro plans."* Não é dúvida: o texto exclui Hobby. A decisão é do dono: migrar para Pro ou pedir termo escrito ao suporte (`privacy@vercel.com`). E-mail pronto em [mensagens-prontas.md](./mensagens-prontas.md). A seção 13.1 reconhece processamento principal nos EUA. Não afirmar que a Vercel tem DPA cobrindo este projeto.
3. **E-mail é Make (Celonis), com DPF primário.** A cláusula 7.1 do DPA, lida em 23/11/2026, diz: se o exportador estiver no EEA e contratar com a Celonis, Inc., o **Data Privacy Framework** ao qual ela é registrada é o mecanismo primário; se o DPF for invalidado, aplicam-se as SCCs da UE (Decisão 2021/914, Módulo Dois), com Celonis Inc. como importadora. O Anexo I das SCCs não fixa país nem endereço — remete ao contrato principal, mas diz que o uso do serviço equivale a assiná-lo (*"will be deemed to have signed this Annex I"*). Nenhum dos dois documentos é cláusula-padrão da ANPD. Falta só confirmar a existência do contrato principal com a Celonis, Inc.
4. **A Supabase abriu um caminho contratual.** A cláusula 12.4 do DPA prevê que, se outro mecanismo for aprovado sob as leis do exportador, as partes devem celebrar aditivo incorporando as cláusulas formais adotadas pela autoridade do país exportador. Isso pode ser usado para pedir as cláusulas da ANPD à Supabase, sem alterar o DPA original.
5. **Cloudflare: importador nos EUA confirmado.** O Anexo 1 do DPA v6.4 identifica Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, EUA, como importadora. A região física do bucket R2 não está no DPA: conforme a [documentação oficial](https://developers.cloudflare.com/r2/reference/data-location), ela aparece em **Settings → Bucket details**. No modo Automatic a Cloudflare escolhe sozinha; Location Hint é *best effort* e só vale na criação; Jurisdictional Restrictions garante jurisdição, mas os exemplos documentados são US, EU e FedRAMP — não aparece Brasil. Roteiro em [mensagens-prontas.md](./mensagens-prontas.md).

## Regra

Nunca colocar nesta pasta um DPA inventado, adaptado ou preenchido por terceiro. Se o documento vier assinado por você, registre a data; se vier pré-assinado pelo operador, escreva "pré-assinado pelo operador".
