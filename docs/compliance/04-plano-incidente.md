# 04 — Plano de comunicação de incidente de segurança

**Base:** LGPD art. 48; Res. CD/ANPD nº 15/2024 (Regulamento de Comunicação de Incidente de Segurança), arts. 4º, 5º, 6º e 9º; Res. CD/ANPD nº 2/2022, art. 14 (prazo em dobro para pequeno porte).
**Objetivo:** saber o que fazer, em quanto tempo e com quais informações quando houver incidente que possa causar risco ou dano relevante.

## Responsável e canal

- **Responsável pela comunicação:** o próprio controlador, Artur Fernandes Macêdo Vinhas. Não há encarregado nomeado (ver [02](./02-enquadramento-pequeno-porte.md)); o controlador assina como representante legal do controlador, com documento que comprove o vínculo, conforme art. 6º, §5º, da Res. 15/2024.
- **Canal com titulares:** `CONTATO` em `src/lib/legal/conteudo.ts` (já publicado na política de privacidade).
- **Canal com a ANPD:** formulário eletrônico disponibilizado pela ANPD / peticionamento no SEI!ANPD.

## Quando comunicar

A obrigação (art. 4º) nasce quando o incidente **poder acarretar risco ou dano relevante**. O art. 5º exige duas condições **cumulativas**:

1. afetar significativamente interesses e direitos fundamentais do titular; **e**
2. envolver ao menos um destes: dados sensíveis; dados de crianças, adolescentes ou idosos; dados financeiros; **dados de autenticação em sistemas**; dados protegidos por sigilo legal/judicial/profissional; ou dados em larga escala.

No LaudoRápido, os cenários mais prováveis de gerar comunicação são: vazamento de cookie/token de sessão (dado de autenticação), exposição indevida de fotos/assinatura com URL pública, ou acesso indevido a visitas de várias empresas.

Na dúvida, **comunique**. A comunicação voluntária é considerada demonstração de transparência e boa-fé.

## Prazos

| Evento | Prazo | Base |
|---|---|---|
| Comunicação à ANPD | **3 dias úteis** contados do conhecimento de que o incidente afetou dados pessoais | Res. 15/2024, art. 6º, caput e §1º |
| Comunicação ao titular | **3 dias úteis** contados do mesmo marco | Res. 15/2024, art. 9º, caput |
| Complementação de informações à ANPD | **20 dias úteis** após a comunicação, com justificativa | Res. 15/2024, art. 6º, §3º |
| Declaração de que comunicou os titulares | **3 dias úteis** após o fim do prazo de comunicação ao titular | Res. 15/2024, art. 9º, §4º |

**Prazo em dobro:** se o enquadramento de pequeno porte estiver documentado e válido (ver [02](./02-enquadramento-pequeno-porte.md)), os prazos de 3 e 20 dias úteis são contados em dobro — art. 6º, §8º, e art. 9º, §6º, da Res. 15/2024, combinados com o art. 14 da Res. 2/2022.

**Regra interna:** usar os prazos **simples (3 dias úteis)** como meta. O dobro é direito eventual, não folga para decidir depois.

## Procedimento

1. **Detectar e conter.** Interromper o acesso indevido (revogar sessões/tokens, ajustar permissões do bucket R2, corrigir regra de firewall). Não apagar evidências.
2. **Classificar.** Aplicar os dois critérios do art. 5º. Registrar a decisão de comunicar ou não, com a razão.
3. **Levantar fatos.** Data da ocorrência (se possível), data do conhecimento, categorias de dados, número de titulares afetados, operadores envolvidos, causa provável, medidas tomadas antes e depois.
4. **Comunicar a ANPD** no formulário oficial, com os 12 itens do art. 6º, §2º:
   - natureza e categorias dos dados;
   - número de titulares (com children/adolescents/idosos quando aplicável);
   - medidas técnicas e de segurança antes e depois;
   - riscos e impactos possíveis;
   - motivos da demora, se houver;
   - medidas de reversão ou mitigação;
   - data da ocorrência e do conhecimento;
   - dados do encarregado ou de quem represente o controlador;
   - identificação do controlador e declaração de pequeno porte, se for o caso;
   - identificação do operador, se aplicável;
   - descrição do incidente e causa principal, se possível;
   - total de titulares cujos dados são tratados na atividade afetada.
5. **Comunicar os titulares** em linguagem simples, de forma direta e individualizada (e-mail) quando possível identificar cada um. Se não for possível, divulgar no site e canais do serviço por, no mínimo, **3 meses** (art. 9º, §3º). Conteúdo mínimo, art. 9º, caput:
   - natureza e categorias dos dados;
   - medidas técnicas e de segurança;
   - riscos e impactos possíveis;
   - motivos da demora, se houver;
   - medidas adotadas ou a adotar;
   - data do conhecimento;
   - contato para informações e, se houver, dados do encarregado.
6. **Registrar a comunicação aos titulares** em até 3 dias úteis após o prazo, com os meios usados (art. 9º, §4º).
7. **Revisar.** Corrigir a causa, atualizar este plano, o ROPA e, se o incidente mudar o tratamento, a política em `src/lib/legal/conteudo.ts` — sempre seguindo o `AGENTS.md`.

## Modelo de comunicação ao titular (linguagem simples)

> **Aviso sobre incidente de segurança — LaudoRápido**
>
> Em [data], tomamos conhecimento de [descreva o que aconteceu de forma simples]. Esse evento pode ter afetado [categorias de dados: por exemplo, e-mail, fotos da visita ou dados de acesso].
>
> O que já fizemos: [medidas de contenção]. O que você pode fazer: [orientações práticas, se houver].
>
> Os possíveis impactos são [riscos em linguagem simples]. Não temos evidência de [o que não foi confirmado — só afirmar se verdadeiro].
>
> Para tirar dúvidas ou pedir informações, escreva para [CONTATO]. Também é possível apresentar petição à ANPD.
>
> [Data do conhecimento]. Controlador: Artur Fernandes Macêdo Vinhas.

## Registro interno de incidentes

| ID | Detecção | Conhecimento | Categorias | Titulares afetados | Decisão (comunicar / não comunicar + razão) | ANPD (data/protocolo) | Titulares (data/meio) | Lição aplicada |
|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — | — | — |

## Atenção

Não prometer "nenhum risco" ou "nenhum dado exposto" sem levantamento. A comunicação à ANPD **não substitui** a comunicação ao titular quando há risco ou dano relevante.
