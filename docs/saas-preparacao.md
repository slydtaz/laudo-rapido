# Preparação para SaaS — LaudoRápido

**Natureza:** documento de design. Não é implementação, contrato nem parecer jurídico.  
**Data:** 21/11/2026  
**Controlador:** Artur Fernandes Macêdo Vinhas (pessoa física, sem CNPJ informado)  
**Contato público:** macedoartur1250@gmail.com  
**Domínio de produção:** `laudo-rapido.vercel.app`

> **AVISO EXPLÍCITO — NADA DISSO ESTÁ IMPLEMENTADO.** Nesta versão não existe cobrança,
> checkout, botão de pagamento, cliente Asaas, webhook de pagamento, chamada de rede para
> operadora de pagamento, credenciais de pagamento, variáveis de ambiente de Asaas, campos
> de cartão/Pix/boleto nem tabela de cobrança no banco. Nenhuma chave de API foi criada.
> A vitrine de planos é somente informativa e traz o aviso:
> `Valores de referência. Nenhuma cobrança é feita nesta versão.`

## 1. Catálogo e preços

Fonte de verdade: `src/lib/saas/planos.ts` (`CATALOGO_PLANOS`) para identificadores,
valores numéricos e sinalizações; `src/lib/i18n/dicionario.ts` para rótulos e textos.
Preços em reais são idênticos nos cinco idiomas (`ptBR`, `en`, `es`, `fr`, `de`);
apenas rótulos e descrições são traduzidos.

| id | Nome exibido | Preço | `precoNumero` | Periodicidade | Condição |
| --- | --- | --- | --- | --- | --- |
| `gratuito` | Gratuito | R$ 0 | `0` | sem `/ mês` (`semPeriodo`) | sem cobrança |
| `pro` | Pro | R$ 29,90 | `29.9` | `/ mês` | cobrança ainda não implementada; plano em destaque |
| `equipe` | Equipe | R$ 79,90 | `79.9` | `/ mês` | cobrança ainda não implementada; condição comercial futura de até 5 técnicos (ver abaixo) |
| `empresas` | Enterprise | Sob consulta | `null` | sem `/ mês` (`semPeriodo`) | contrato comercial direto |

A condição "até 5 técnicos" é uma **intenção de precificação para fase futura**, não uma
capacidade implementada. Ela **não aparece na vitrine em nenhum idioma**: os textos de
`nome`, `dica` e `itens` dos quatro planos são apenas públicos-alvo e recursos existentes.
Hoje não existe associação de técnicos a uma conta, limite técnico aplicado nem cobrança
por usuário. Se a condição for mantida quando a cobrança entrar, ela deverá ser apresentada
na tela pré-contratual como termo comercial — nunca como recurso entregue.

Os itens da vitrine listam apenas recursos que existem: visitas, fotos, assinatura, laudo
em PDF, sincronização offline e histórico no aparelho. Foram removidas as promessas de API,
SLA, gerente de conta, marca própria, modelos personalizados, 12 meses de histórico,
suporte prioritário e usuários ilimitados.

## 2. Modelo de assinatura desejado (fase futura — apenas desenho)

Desenho proposto, a ser revisado por advogado brasileiro antes de qualquer cobrança:

1. **Cliente Asaas:** cadastro do cliente com nome, CPF/CNPJ e e-mail do contratante,
   vinculado à conta autenticada do LaudoRápido. Nenhum dado é enviado hoje.
2. **Assinatura:** assinatura recorrente mensal referente ao `id` do plano
   (`pro` ou `equipe`), usando `precoNumero` como valor base.
3. **Cobrança recorrente:** geração da cobrança no ciclo mensal, com Pix e cartão como
   formas de pagamento previstas. O valor final deve considerar as taxas abaixo.
4. **Webhook de confirmação:** recebimento do evento de pagamento, com verificação de
   autenticidade da assinatura do payload antes de qualquer mudança de estado. Nenhum
   endpoint de webhook existe hoje.
5. **Status:** `ativo`, `inadimplente` e `cancelado`, refletindo exclusivamente o estado
   confirmado pelo operador de pagamento.
6. **Renovação:** renovação mensal automática enquanto a assinatura estiver `ativo`,
   com registro de cada cobrança e o respectivo status.
7. **Cancelamento:** cancelamento iniciado pelo titular ou por inadimplência, com
   atualização do status e confirmação por e-mail pelo canal já existente.

### Taxas de referência (revalidar antes da cobrança real)

- Pix: **R$ 1,99** por cobrança.
- Cartão à vista: **R$ 0,49 + 2,99%** por cobrança.

Referência de precificação da spec: Mitti US$ 24/usuário/mês e Fieldwire
US$ 39/usuário/mês em 2026; R$ 29,90 fica abaixo do equivalente em dólar sem tornar a
cobrança inviável. Em R$ 19,90 a taxa do Pix consumia cerca de 10% da receita. Esses
números são de 2026 e devem ser confirmados com o operador antes da implantação.

## 3. Requisitos CDC para a futura cobrança

Quando a cobrança real entrar, a tela pré-contratual deverá exibir, de forma clara e
antes da aceitação:

- **Preço:** valor em reais do plano escolhido, informado com clareza que não induza a erro.
- **Periodicidade:** mensal, expressamente informada.
- **Total:** valor total do ciclo e o que está incluído.
- **Renovação:** renovação automática e como ela acontece.
- **Cancelamento:** como cancelar, sem obstáculos e a qualquer momento.
- **Arrependimento:** direito de arrependimento de **7 dias**, com prazo e forma de
  exercício informados.

A política de privacidade e os termos de uso precisam ser revisados por advogado antes
dessa etapa. Nenhuma cláusula da LGPD ou do CDC pode ser renunciada. Nenhuma renúncia
a direitos do titular está prevista neste documento.

## 4. Estado atual e limites

- O catálogo de domínio existe apenas em código (`src/lib/saas/planos.ts`); uma futura API
  de configuração dinâmica poderá sobrepor preços sem rebuild.
- O callback OAuth permanece `/api/v1/auth/google/callback` e não é alterado por esta tarefa.
- O gate de acesso (`EMAIL_PERMITIDO`, `exigirAcesso`, middleware) permanece intacto.
- Não há CNPJ, endereço, encarregado de dados ou canal de pagamento inventados neste
  documento. O contato do controlador é o e-mail indicado no cabeçalho.

Este documento registra intenção de arquitetura e requisitos. Implementar qualquer item
desta seção 2 ou 3 exigirá nova tarefa, TDD, revisão e aprovação explícita do dono.
