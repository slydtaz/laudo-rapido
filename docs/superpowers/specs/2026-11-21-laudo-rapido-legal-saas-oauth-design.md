# LaudoRápido — design legal, planos, OAuth de produção e deploy

**Status:** aguardando aprovação do dono  
**Data:** 21/11/2026  
**Dono:** Artur Fernandes Macêdo Vinhas  
**Contato público:** macedoartur1250@gmail.com  
**Domínio de produção:** `laudo-rapido.vercel.app`  
**Specs relacionadas:** `2026-11-21-laudo-rapido-producao-gate-design.md`, `2026-11-21-rust-pdf-nativo-design.md`

## 1. Objetivo

Fechar o que impede publicação segura: documentos legais honestos, vitrine de planos sem promessa falsa, caminho OAuth já apontado para produção, preparação de SaaS sem cobrança real, conclusão das Tasks 8–11 do gate e deploy na Vercel.

Não é objetivo desta entrega: multi-tenant público, cadastro aberto, cobrança recorrente ativa, API pública, SLA, marca própria ou modelos personalizados.

## 2. Decisões já tomadas pelo dono

- Abordagem 1 agora: manter gate privado por allowlist, corrigir preços e textos, preparar modelo de assinatura sem cobrar.
- Abordagem 2 depois: SaaS completo em fase separada.
- URL de produção: `https://laudo-rapido.vercel.app`.
- Ordem: terminar políticas e preços antes de publicar.
- E-mail de contato digitado como `macedoartur1250@gmai.com`; assumido `macedoartur1250@gmail.com` por coerência com a allowlist.

## 3. Identidade do controlador

- Nome: Artur Fernandes Macêdo Vinhas.
- Natureza: pessoa física, sem CNPJ informado.
- Canal público: `macedoartur1250@gmail.com`.
- Endereço: não informado. Não será inventado.
- Encarregado de dados: não nomeado. O canal acima serve como contato de privacidade. Se advogado recomendar encarregado formal, o dono informa depois.

## 4. Documentos legais

### 4.1 Rotas e exposição

- Criar `src/app/(publico)/privacidade/page.tsx`, `src/app/(publico)/termos/page.tsx`, `src/app/(publico)/cookies/page.tsx`.
- Adicionar `/privacidade`, `/termos`, `/cookies` a `ROTAS_PUBLICAS` em `src/middleware.ts`. O route group sozinho não basta.
- Não colocar essas páginas no grupo `(app)`. Não adicioná-las ao `SHELL` do service worker. Nenhuma página legal em cache offline.
- Adicionar um componente de rodapé legal client-side em `src/app/layout.tsx`, após `{children}`, com os três links. Assim ele aparece em login, planos, conta e páginas públicas sem mexer na autorização de cada página.
- Aviso destacado no formulário de login: o fornecimento de e-mail é condição de uso, com links inline para Privacidade e Termos.
- Link para Privacidade e Termos no rodapé da vitrine de planos.
- Seção “Privacidade e seus dados” em `/conta` e `/configuracoes`, com link para a Política de Privacidade e o canal de titular. Texto deve dizer que não existe exportação/exclusão self-service hoje.
- Tela `/em-desenvolvimento` continua neutra. Nenhuma menção a allowlist, e-mail bloqueado ou motivo do bloqueio.

### 4.2 Idioma

- PT-BR é a versão autoritativa de todos os documentos legais.
- Os cinco idiomas (`ptBR`, `en`, `es`, `fr`, `de`) recebem títulos, links e um aviso curto de que a versão PT-BR prevalece em caso de conflito.
- Não traduzir o corpo jurídico nesta entrega. Isso evita duas versões com escopo divergente.

### 4.3 Política de Privacidade — conteúdo obrigatório

- Identificação e contato do controlador.
- Data de vigência e política de alteração.
- Dados tratados, por finalidade:
  - Conta: e-mail, nome, hash de senha, `sub` do Google, verificação de e-mail.
  - Visitas: nome do cliente, tipo, observações, data de captura.
  - Mídias: fotos e imagem da assinatura enviadas ao Cloudflare R2, com URL pública.
  - Entrega: token opaco do link `/o/:token`.
  - Segurança: chave derivada de IP + e-mail em `tentativas_login`.
  - Preferências locais: tema, idioma, movimento, sincronização automática e tamanho de texto.
- Base legal por finalidade: execução de contrato para conta e visitas; legítimo interesse para segurança e prevenção a fraude; obrigação legal quando aplicável; consentimento apenas se uso futuro depender dele.
- Dados de terceiros: o técnico coleta nome, foto e assinatura do cliente. O texto deixa claro que o técnico é responsável pela origem lícita desses dados e pela ordem de compartilhamento do link.
- Compartilhamento e operadores: Google (OAuth), provedor de e-mail por webhook, Cloudflare R2 (mídia com URL pública), Vercel e provedor de Postgres.
- Transferência internacional: mencionar que operadores podem processar dados fora do Brasil e descrever a garantia adotada, em linguagem simples, conforme Res. ANPD 19/2024.
- Retenção, de forma honesta:
  - cookies `sessao` 7 dias e `oauth` 10 minutos;
  - tokens de verificação/redefinição com validade curta já implementada;
  - visitas, fotos e assinaturas: enquanto a conta estiver ativa ou até pedido de exclusão;
  - declarar expressamente que não existe hoje rotina automática de expurgo e que pedidos são atendidos manualmente pelo canal de contato.
- Direitos do art. 18 da LGPD, gratuidade, prazo de resposta e como petitionar ANPD.
- Aviso destacado de que o tratamento é condição de uso do serviço.
- Segurança em alto nível, sem expor segredos: Argon2, PKCE, cookies HttpOnly/SameSite/Secure, consultas escopadas por tenant, service worker sem cache de dados.
- Compromisso de comunicação de incidente pelo canal público.
- Serviço não dirigido a crianças.
- Aviso de que o PDF tem valor documental, mas não substitui perícia, laudo técnico regulamentado nem orientação jurídica.

### 4.4 Termos de Uso — conteúdo obrigatório

- Aceite e quem contrata: técnico ou empresa representada pelo usuário.
- Descrição do serviço: captura offline-first, sincronização, PDF entregue na hora, link opaco de entrega.
- Elegibilidade: acesso privado e restrito, passível de revogação; redigido de forma neutra, sem revelar a allowlist.
- Responsabilidade do usuário: exatidão dos dados, licitude da coleta de fotos e assinatura do cliente, compartilhamento do link apenas com o destinatário.
- Propriedade e licença do conteúdo e do PDF gerado.
- Limitações: funcionamento offline, falha de sincronização, tamanho de mídia, indisponibilidade.
- Suspensão e encerramento, com link para a Política de Privacidade.
- Lei brasileira e foro brasileiro.
- Nenhuma renúncia a direitos da LGPD ou do CDC. Nenhuma cláusula abusiva.
- Enquanto não houver cobrança: texto explícito de que nenhum valor é cobrado nesta versão.

### 4.5 Política de Cookies — conteúdo obrigatório

- Definição simples de cookie e armazenamento local.
- Lista exata:
  - `sessao`: 7 dias, HttpOnly, SameSite=Lax, Secure em produção — essencial;
  - `oauth`: 10 minutos, mesmos atributos — essencial;
  - `laudo-rapido:preferencias:v1` em localStorage — preferências;
  - IndexedDB `laudo-rapido-offline` — rascunhos, fotos, assinaturas e tokens de entrega.
- Afirmação confirmada por inspeção do código: não há analytics, anúncios, pixel, perfilamento ou rastreadores de terceiros.
- Por isso, não há banner de consentimento nesta versão.
- Regra futura: se entrar cookie não essencial, exigir opt-in granular, botão de rejeitar tudo e retirada fácil, conforme orientação ANPD.
- Como limpar dados locais e consequência: visitas pendentes não sincronizadas são perdidas.
- Link para a Política de Privacidade e data de atualização.

## 5. Planos e preços

### 5.1 Catálogo

| Plano | Preço | Condição |
| --- | --- | --- |
| Gratuito | R$ 0 | sem cobrança |
| Pro | R$ 29,90/mês | cobrança ainda não implementada |
| Equipe | R$ 79,90/mês | até 5 técnicos; cobrança ainda não implementada |
| Enterprise | Sob consulta | contrato comercial |

Justificativa: Mitti US$24/usuário/mês e Fieldwire US$39/usuário/mês em 2026; R$29,90 fica abaixo do equivalente em dólar sem tornar a cobrança inviável. Asaas cobra R$1,99 por Pix e R$0,49 + 2,99% por cartão à vista; em R$19,90 o Pix comia 10% da receita.

### 5.2 Vitrine honesta

- Manter `Nenhuma cobrança é feita nesta versão`.
- Listar só recursos implementados: visitas, fotos, assinatura, PDF, sincronização offline, histórico no aparelho.
- Remover da vitrine, ou marcar explicitamente como “planejado, indisponível”: sem marca LaudoRápido, modelos personalizados, histórico de 12 meses no servidor, até 5 técnicos, API, SLA, gerente de conta.
- Nenhum botão de checkout, campo de cartão, Pix ou boleto nesta entrega.
- Preços ficam em `src/lib/i18n/dicionario.ts` e no catálogo de domínio em `src/lib/saas/planos.ts`, para a futura API de configuração dinâmica sobrepor sem rebuild.

### 5.3 Preparação SaaS sem cobrança

- Criar catálogo de domínio com identificadores estáveis dos quatro planos, preços e limites.
- Documentar o modelo de assinatura desejado com Asaas: cliente, assinatura, cobrança recorrente, webhook de confirmação, status ativo/inadimplente/cancelado, renovação e cancelamento.
- Não criar tabela de cobrança, chave de API, webhook, cliente Asaas nem chamada de rede.
- CDC: quando a cobrança real entrar, a tela pré-contratual precisa mostrar preço, periodicidade, total, renovação, cancelamento e direito de arrependimento de 7 dias. Registrar como requisito da fase 2.

## 6. OAuth de produção

- Callback real do código: `/api/v1/auth/google/callback`.
- URI exata: `https://laudo-rapido.vercel.app/api/v1/auth/google/callback`.
- `GOOGLE_REDIRECT_URI` passa a ser obrigatória em produção. Se ausente, fluxo Google devolve 503 com mensagem neutra. Nunca cair em `localhost` em produção.
- Manter fallback `http://localhost:3000/...` apenas em desenvolvimento.
- Adicionar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_REDIRECT_URI` a `.env.example` e a `docs/deploy-vercel.md`, sem valores.
- Fluxo existente já usa `openid email profile`, PKCE `S256`, `state` em cookie, validação RS256 via JWKS e exige `email_verified === true`. Nenhuma mudança de protocolo.
- O dono cadastra a URI no Google Cloud Console e configura as três variáveis no painel da Vercel. Nenhuma credencial em chat, log, commit ou arquivo versionado.

## 7. Deploy na Vercel

- Login detectado: `macedoartur1250-7456`. Projeto `laudo-rapido` ainda não existe. Sem remote git e sem `.vercel` linkado.
- `vercel.json` já fixa `framework: nextjs` e `regions: ["gru1"]`.
- Etapas: criar projeto, finalizar Tasks 8–11 do gate, suíte completa, build, configurar variáveis no painel pelo dono, `vercel --prod`, smoke com `curl` nas rotas públicas e no gate.
- Migrações: executar pelo dono no banco de produção antes do smoke, com o comando já previsto na Task 11.
- Nenhum push, merge ou deploy antes de a suíte passar e o dono confirmar que as variáveis estão prontas.

## 8. Ordem de execução

1. Aprovação deste doc.
2. `writing-plans` com tarefas atômicas e TDD.
3. Execução via SDD: páginas legais, rodapé e links; textos e catálogo de planos; OAuth de produção; Tasks 8–11 do gate.
4. Revisão por tarefa, suíte com `--maxWorkers=4`, build.
5. Criação do projeto Vercel e configuração das variáveis pelo dono.
6. `vercel --prod` e smoke.

## 9. Riscos

- Publicar antes das políticas e da correção de preços gera exposição LGPD/CDC. É o risco que esta sequência elimina.
- Prometer exclusão automática sem rotina implementada é falso. Texto assume Atendimento manual.
- Traduzir o corpo legal cria versões divergentes. A versão PT-BR prevalece por decisão.
- Sem template de email transacional dedicado, o link de verificação depende do webhook configurado pelo dono.
- As taxas Asaas e preços de concorrentes são de 2026 e devem ser revalidados antes da cobrança real.
- Este doc é engenharia e estratégia, não parecer jurídico. Advogado brasileiro deve revisar os textos finais antes da cobrança ou da abertura pública.

## 10. Critério de aceite

- `/privacidade`, `/termos`, `/cookies` acessíveis sem sessão e com links no rodapé de pá públicas e autenticadas.
- Nenhuma promessa de recurso não implementado na vitrine; preços conferem com o catálogo.
- `GOOGLE_REDIRECT_URI` aponta para o domínio de produção; produção sem a variável falha fechada.
- Suíte completa verde, build verde, Tasks 1–11 do gate fechadas.
- Deploy em `laudo-rapido.vercel.app` com variáveis configuradas pelo dono e smoke documentado.
