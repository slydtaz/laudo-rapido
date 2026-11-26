# Mensagens prontas para copiar

**Como usar:** copie o texto, cole no e-mail e troque só o que está entre colchetes. **Nunca** cole token, URL de webhook, chave de API ou senha.

---

## 1. Vercel — o problema do plano Hobby

**Para:** `privacy@vercel.com` (endereço que está no próprio DPA da Vercel)
**Assunto:** DPA e plano Hobby — LaudoRápido

> Olá.
>
> Sou controlador de dados pessoais no Brasil e uso a Vercel no LaudoRápido, no plano **Hobby**.
>
> O DPA publicado em `vercel.com/legal/dpa` diz na seção 1 que se aplica a clientes dos planos **Enterprise e Pro**. Como minha conta é Hobby, gostaria de saber:
>
> 1. Existe algum DPA ou termo de processamento de dados que cubra contas do plano Hobby? Se sim, onde posso baixá-lo?
> 2. Se eu migrar para o plano Pro, o DPA publicado passa a valer automaticamente?
> 3. Para dados de requisição, cookies de sessão e endereço IP de usuários no Brasil, qual mecanismo de transferência internacional a Vercel indica para fins da LGPD?
>
> Exportador: Artur Fernandes Macêdo Vinhas, pessoa física, controlador do LaudoRápido. Contato: `macedoartur1250@gmail.com`.
>
> Obrigado.

**Se a resposta disser que não há DPA para Hobby:** a decisão é sua — migrar para Pro (cobrando ou não) ou aceitar o risco com o plano atual. Eu não decido isso por você.

---

## 2. Supabase — pedido de aditivo com cláusulas da ANPD

**Para:** `privacy@supabase.io` (endereço que está no DPA da Supabase)
**Assunto:** Aditivo ao DPA — cláusulas-padrão da ANPD (LGPD, Res. 19/2024)

> Olá.
>
> Sou controlador de dados pessoais no Brasil e uso a Supabase no LaudoRápido. Recebi o DPA versão 1, de 01/08/2026, e o arquivei em 22/11/2026.
>
> A cláusula 12.4 do DPA prevê que, se o exportador estiver sujeito a leis que exigem outro mecanismo, as partes devem celebrar aditivo que incorpore **quaisquer cláusulas-padrão de proteção de dados ou outro mecanismo de transferência formalmente adotado pela autoridade competente da jurisdição do exportador**.
>
> No Brasil, essa autoridade é a ANPD e as cláusulas estão no **Anexo II da Resolução CD/ANPD nº 19/2024**.
>
> Gostaria de saber se vocês aceitam assinar esse aditivo, sem alterar o restante do DPA. Se não aceitarem, por favor confirmem por escrito qual mecanismo vocês adotam para transferências vindas do Brasil e em quais países os dados são processados.
>
> Exportador: Artur Fernandes Macêdo Vinhas, pessoa física, controlador do LaudoRápido. Contato: `macedoartur1250@gmail.com`.
>
> Obrigado.

---

## 3. Cloudflare R2 — onde olhar no painel

Fonte oficial: https://developers.cloudflare.com/r2/reference/data-location

1. Abra `dash.cloudflare.com` e entre em **R2 Object Storage**.
2. Clique no bucket usado pelo LaudoRápido.
3. Vá na aba **Settings** → seção **Bucket details** e anote a localização mostrada.
4. Envie para mim só o nome da região (exemplo: `Automatic — WNAM`). Pode mandar o texto; **não** mande chaves de acesso.

**Duas ressalvas importantes da documentação da Cloudflare:**

- Se o bucket foi criado no modo **Automatic**, a Cloudflare escolhe a região mais próxima de quem criou — não é escolha sua, e pode ter sido fora do Brasil.
- Para forçar região existe **Location Hint** (`wnam`, `enam`, `weur`, `eeur`, `apac`, `oc`), mas a própria Cloudflare diz que é *best effort, not a guarantee* e que só vale na criação do bucket. Existe também **Jurisdictional Restrictions** (exemplos documentados: US, EU, FedRAMP), que garante a jurisdição — mas a lista documentada não mostra uma opção Brasil.

Ou seja: **primeiro você descobre onde o bucket está**; só depois decide se vale recriar em outra região.

---

## 4. Make — o que já está resolvido e o que falta

O Anexo I das SCCs da Make diz literalmente: *"By using the Celonis services to transfer Customer Data to Third Countries, the data exporter will be deemed to have signed this Annex I."*

Traduzindo: **usar o serviço já conta como assinatura desse anexo**. Então essa parte não exige clique nem e-mail.

O que falta é só guardar uma confirmação de que a conta da Make está sob contrato com a **Celonis, Inc.** — o DPA da Make fala "se você contratar com a Celonis, Inc.". Se você usa a Make, muito provavelmente esse contrato existe, mas eu não tenho como verificar sem acesso à sua conta.

## Regra

Nenhum destes e-mails afirma que o serviço "está conforme". Eles só pedem documento e resposta escrita. Guarde as respostas na pasta `contratos/` com a data.
