# 01 — Transferência internacional de dados

**Base:** LGPD art. 33; Res. CD/ANPD nº 19/2024 (Anexo I — Regulamento de Transferência Internacional de Dados; Anexo II — Cláusulas-Padrão Contratuais).
**Atualizado em:** 23/11/2026
**Objetivo:** ter evidência escrita do mecanismo de proteção usado por cada operador que processa dados fora do Brasil.

## Situação atual

A política pública dizia que o serviço "exigia garantias contratuais ... incluindo cláusulas-padrão". Não havia DPA, termo ou cláusula-padrão arquivado no projeto. Em 22/11/2026 o texto foi ajustado para descrever o que é verificável e **7 documentos oficiais foram baixados**, registrados em [contratos/README.md](./contratos/README.md). Em 23/11/2026 os mecanismos da Make e da Cloudflare foram confirmados por leitura direta.

**Resultado em 23/11/2026:** restam **uma resposta a receber** (Supabase) e **uma decisão sua** (Vercel). A Google não é operadora neste fluxo. A Make e a Cloudflare têm documentos lidos, mas a região física do R2 ainda depende do painel.

**Achado que exige decisão do dono:** o DPA público da Vercel **não cobre o plano Hobby**. Ver seção 2. Não é uma infração cometida; é uma lacuna contratual a resolver.

**Regra:** enquanto houver status "a conferir" ou "a confirmar", não afirmar publicamente que determinado operador já tem cláusulas-padrão da ANPD.

## Operadores e documentação (23/11/2026)

| # | Operador | Dados envolvidos | Documento arquivado | País declarado | Mecanismo declarado | Status |
|---|---|---|---|---|---|---|
| 1 | **Google** — Gmail pessoal (login OAuth) | e-mail, nome, `sub`, `email_verified` | `google-termos.html`, `google-privacidade.html` | Servidores ao redor do mundo | **Sem DPA**: Google não é operadora na versão consumidor; valem Termos e Política | **Documentado — sem DPA aplicável** |
| 2 | **Make** (webhook de e-mail) | e-mail e link com token de verificação/redefinição | `email-dpa.pdf`, `make-scc.pdf` | Celonis, Inc. (registrada no DPF EUA-UE); endereço remetido ao contrato | DPA Celonis v05/2024, cláusula 7.1: DPF primário; SCCs UE Módulo Dois se o DPF cair | **Mecanismo lido — contrato principal a confirmar** |
| 3 | **Cloudflare R2** | fotos e assinaturas (URL pública) | `cloudflare-dpa.pdf` | **EUA** — Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107 (Anexo 1) | DPA v6.4; DPF (cláusula 6.4), SCCs UE (6.2) e Global PRP (seção 7) | **Importador confirmado — região do bucket a ver no painel** |
| 4 | **Vercel** — plano Hobby | dados de requisição, cookies de sessão, IP | `vercel-dpa.html` | Vercel Inc. (Delaware), EUA | DPA vigente desde 31/03/2026, **mas a seção 1 limita-o a Enterprise e Pro** | **Sem DPA aplicável no plano atual — decisão do dono** |
| 5 | **Supabase** (Postgres) | conta, visitas, sessões, tokens, tentativas de login | `supabase-dpa.html` | Singapura (Supabase Pte. Ltd) | DPA v1 de 01/08/2026 + SCCs da UE (Módulo Dois); cláusula 12.4 prevê aditivo com mecanismo formal do exportador | **Aguardando resposta da Supabase** |

Mensagens prontas para copiar em [mensagens-prontas.md](./contratos/mensagens-prontas.md).

## Achados que mudaram o planejamento

### 1. Gmail pessoal não tem DPA — e a Google não é operadora aqui

A Central de Ajuda da Google é explícita: *"Google doesn't offer a Data Processing Agreement for the consumer versions of Gmail or Drive. Google does not act as a data processor for the consumer version of these services."* Na versão consumidor valem os [Termos de Serviço](https://policies.google.com/terms?hl=pt-BR) e a [Política de Privacidade](https://policies.google.com/privacy?hl=pt-BR).

Na prática, o fluxo é inverso ao que se presume: a Google entrega nome/e-mail/`sub` ao LaudoRápido depois que o usuário autoriza. O LaudoRápido não envia dados dos clientes à Google como operadora. Portanto **não há DPA da Google para arquivar**, e o CDPA (que cobre Workspace/Cloud Identity/GCP) foi deixado de fora de propósito. Fonte: https://support.google.com/legal-help-center/answer/13885940?hl=en

### 2. Vercel Hobby: o DPA publicado não cobre o plano atual

A seção 1 do [DPA da Vercel](https://vercel.com/legal/dpa) diz literalmente:

> "This Data Processing Addendum ... forms part of Vercel Enterprise Terms and Conditions or other agreement executed between Vercel and Customer for Vercel's provision of Services on an Enterprise plan ... **This Addendum applies to Vercel's Processing of Personal Data as a Processor under the Agreement for Customers who are on Enterprise and Pro plans.**"

Ou seja: não é dúvida. O texto **exclui o plano Hobby**. O projeto usa Hobby. Duas saídas possíveis, e a escolha é sua:

- **Migrar para Pro** — nesse caso o DPA publicado passa a valer (confirmar por escrito);
- **Perguntar ao suporte** se existe termo equivalente para Hobby — e-mail pronto em [mensagens-prontas.md](./contratos/mensagens-prontas.md).

A seção 13.1 do mesmo DPA reconhece que o processamento principal da Vercel fica nos **EUA** e que dados podem ir a qualquer país onde a Vercel ou seus suboperadores operem. Enquanto não houver decisão, não afirmar que a Vercel tem DPA cobrindo este projeto.

### 3. Make/Celonis e Supabase usam cláusulas da UE, não da ANPD

Os documentos da Make e da Supabase trazem SCCs da UE. Isso é documentação real, mas **não é** o Anexo II da Res. 19/2024. A Resolução admite cláusulas-padrão da ANPD como um mecanismo e também prevê outros (adequação, normas corporativas globais, selos/certificações/códigos de conduta e outras garantias). **Não afirmar que SCC da UE basta para a LGPD sem conferência.**

Na Make, a cláusula **7.1** do DPA (lida em 23/11/2026) estabelece: para exportador no EEA contratando com Celonis, Inc., o **Data Privacy Framework** é o mecanismo primário; se o DPF for invalidado, aplicam-se as SCCs da UE (Decisão 2021/914, Módulo Dois Controlador→Operador), com Celonis Inc. como importadora. O Anexo I não fixa país nem endereço da importadora — remete ao contrato principal. O mesmo Anexo I diz que o uso do serviço equivale a assiná-lo (*"will be deemed to have signed this Annex I"*). Falta só a confirmação de que existe contrato com a Celonis, Inc.

A Supabase oferece um caminho: a cláusula **12.4** do DPA prevê que, se a autoridade do exportador tiver adotado cláusulas-padrão ou outro mecanismo, as partes devem celebrar aditivo incorporando-as — no Brasil, as da Res. 19/2024. E-mail pronto em [mensagens-prontas.md](./contratos/mensagens-prontas.md).

A Resend, que era candidata a provedora de e-mail, **declara que não assina cláusulas brasileiras**. Como o webhook é da Make, esse ponto não se aplica ao serviço atual — mas fica registrado para o caso de troca de provedor.

### 4. Cloudflare: importador nos EUA, região do bucket é configuração

O Anexo 1 do DPA v6.4, conferido em 23/11/2026, identifica a importadora: **Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, EUA**. O mesmo DPA prevê três caminhos: DPF (cláusula 6.4), SCCs da UE (cláusula 6.2) e Global PRP System (seção 7).

A região física do bucket R2 **não** consta do DPA. Conforme a [documentação oficial da Cloudflare](https://developers.cloudflare.com/r2/reference/data-location), ela fica em **Settings → Bucket details** no painel. Ressalvas:

- No modo **Automatic** (padrão), a Cloudflare escolhe a região mais próxima de quem criou o bucket;
- **Location Hint** (`wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`) é *best effort*, não garantia, e só vale na criação;
- **Jurisdictional Restrictions** garante a jurisdição, mas os exemplos documentados são US, EU e FedRAMP — não aparece uma opção Brasil.

Não afirmar que a mídia fica no Brasil sem verificar no painel.

## Próximos passos (o que falta de verdade)

1. **Decisão sua:** migrar a Vercel para Pro ou manter Hobby e registrar a resposta do suporte.
2. **Enviar** o e-mail pronto da Supabase e guardar a resposta em `contratos/`.
3. **Conferir** no painel da Cloudflare a região do bucket R2 (roteiro em [mensagens-prontas.md](./contratos/mensagens-prontas.md)) e anotar aqui.
4. **Guardar** confirmação de que a conta da Make está sob contrato com a Celonis, Inc.
5. Se alguma resposta mudar o texto público da política, atualizar `src/lib/legal/conteudo.ts`, `VIGENCIA`, o teste e este dossiê no mesmo commit, conforme `AGENTS.md`.

## Modelo de solicitação (copiar e adaptar)

> Assunto: Solicitação de aditivo de transferência — cláusulas-padrão da ANPD (LGPD)
>
> Olá. Sou controlador de dados pessoais no Brasil e uso [produto/serviço] no LaudoRápido. Já recebi o DPA de vocês, arquivado em 22/11/2026.
>
> Como o tratamento envolve dados de pessoas no Brasil, gostaria de saber se vocês aceitam celebrar aditivo ao DPA incorporando as **cláusulas-padrão contratuais aprovadas pela ANPD** (Resolução CD/ANPD nº 19/2024, Anexo II), sem alteração de texto — conforme a cláusula 12.4 do DPA da Supabase, quando aplicável.
>
> Se não aceitarem, por favor confirmem por escrito qual mecanismo de transferência vocês adotam para dados vindos do Brasil e em qual país os dados são processados.
>
> Exportador: Artur Fernandes Macêdo Vinhas, pessoa física, controlador do serviço LaudoRápido. Contato: `macedoartur1250@gmail.com`.
>
> Obrigado.

## Como conferir as cláusulas-padrão da ANPD (quando houver)

- **Cláusula 1** — identificação das partes (exportador = controlador; importador = operador);
- **Cláusula 2** — finalidades, categorias de dados, período de armazenamento e país;
- **Cláusula 10** — obrigações gerais, inclusive manter registro das operações;
- **Cláusula 14** — transparência: forma, duração, finalidade, país de destino, contatos, direitos do titular — em português; pode integrar a política de privacidade;
- **Cláusula 15** — direitos do titular e prazo de 15 dias;
- **Cláusula 16** — comunicação de incidente em 3 dias úteis;
- **Cláusulas 20 e 21** — eliminação ao fim do tratamento e medidas de segurança;
- **Cláusula 24** — legislação brasileira e foro no Brasil.

## Checklist de aceite

- [x] Identidade dos 5 operadores conferida no código.
- [x] Documentos oficiais baixados e índice preenchido em `contratos/README.md`.
- [x] Google Gmail confirmado como sem DPA aplicável (fonte oficial da Google).
- [x] Cloudflare: importador e país anotados (Anexo 1 do DPA v6.4).
- [x] Make: mecanismo prevalecente anotado (cláusula 7.1 — DPF primário, SCCs fallback).
- [x] Mensagens prontas para Vercel e Supabase e roteiro do R2 em `contratos/mensagens-prontas.md`.
- [ ] **Decisão do dono:** Vercel Hobby (migrar para Pro ou obter termo escrito).
- [ ] Cloudflare: região do bucket R2 anotada a partir do painel.
- [ ] Supabase: resposta sobre o aditivo da cláusula 12.4.
- [ ] Make: confirmação do contrato principal com a Celonis, Inc.
- [ ] Após tudo isso, conferir se a política pública precisa mudar e, se precisar, atualizar no mesmo commit.

## O que eu não posso fazer por você

Enviar e-mail, receber resposta, decidir o plano da Vercel e abrir o painel da Cloudflare são atos seus. Posso redigir as mensagens, baixar e ler os documentos e preencher o índice — foi o que fiz até aqui.
