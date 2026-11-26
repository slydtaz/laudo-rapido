# 02 — Enquadramento como agente de tratamento de pequeno porte

**Base:** Res. CD/ANPD nº 2/2022 (Regulamento de aplicação da LGPD a agentes de pequeno porte), arts. 2º, 3º, 4º, 9º, 11, 14 e 16.
**Objetivo:** fundamentar a dispensa de encarregado (LGPD art. 41) sem inventar um nome nem alegar benefício que não cabe.
**Termo assinado:** [assinados/2026-11-22-declaracao-pequeno-porte.md](./assinados/2026-11-22-declaracao-pequeno-porte.md), em 22/11/2026.

## O que a norma diz

- **Art. 2º, I:** são agentes de pequeno porte, entre outros, **pessoas naturais** e entes privados despersonalizados que realizam tratamento de dados pessoais assumindo obrigações típicas de controlador ou operador.
- **Art. 3º:** **não** se beneficia quem (I) realiza tratamento de alto risco, ressalvado o art. 8º; (II) aufere receita bruta acima do limite de ME/EPP (LC 123/2006) ou, se startup, acima do limite da LC 182/2021; ou (III) pertence a grupo econômico cuja receita global ultrapasse esses limites.
- **Art. 4º:** alto risco exige **cumulativamente** um critério geral (larga escala **ou** afetação significativa de interesses/direitos fundamentais) e um critério específico (tecnologia emergente; vigilância de zona acessível ao público; decisão unicamente automatizada com perfilamento; dados sensíveis ou de crianças/adolescentes/idosos).
- **Art. 11:** os agentes de pequeno porte **não são obrigados** a indicar encarregado. **§1º:** quem não indicar **deve disponibilizar canal de comunicação com o titular** para atender o art. 41, §2º, I, da LGPD. **§2º:** indicar encarregado é boa prática.
- **Art. 9º:** o registro de operações do art. 37 pode ser simplificado (ver [03-ropa-simplificado.md](./03-ropa-simplificado.md)).
- **Art. 14:** prazo em dobro para atendimento ao titular e para comunicação de incidente, nos termos da Res. 15/2024.
- **Art. 16:** a ANPD pode determinar o cumprimento das obrigações dispensadas se as circunstâncias mudarem.

## Fatos do LaudoRápido (verificados em 22/11/2026)

| Critério | Situação | Fonte no projeto |
|---|---|---|
| Controlador | Pessoa física, sem CNPJ informado | `src/lib/legal/conteudo.ts:27` |
| Receita bruta | Nenhuma cobrança implementada; termos dizem "nenhuma cobrança é feita nesta versão" | `conteudo.ts:181` |
| Grupo econômico | Não declarado; sem indício no código ou docs | `docs/` |
| Canal com titular | E-mail público de privacidade | `conteudo.ts:28` |
| Crianças | Serviço não dirigido a crianças; sem coleta intencional | `conteudo.ts:116` |
| Decisão automatizada | PDF gerado a partir dos dados informados; sem perfilamento pessoal/profissional/de consumo | `src/lib/pdf/laudo.ts`, `src/app/(app)/o/[token]/page.tsx` |
| Vigilância de zona pública | Não há; a visita registra vistoria/inspeção, não vigilância de via ou espaço público | `docs/spec.md` |
| Dados financeiros / de saúde | Não coletados | schema do banco |
| Escala | Uso inicial, sem indício de larga escala; reavaliar se crescer | `docs/deploy-vercel.md` |

### Ponto que exige cuidado: fotos e assinatura

Fotos e assinaturas são **dados pessoais** e trafegam com **URL pública** no Cloudflare R2. O entendimento adotado aqui é que o uso atual é **documental** — registrar visualmente a visita e manifestar vontade no laudo —, e não identificação única automatizada nem reconhecimento biométrico. Assim, não foram classificados como dado sensível (biométrico) para esta análise.

Se passar a haver reconhecimento facial, leitura de digital, verificação automatizada de assinatura ou qualquer uso para identificar a pessoa de forma única, **o enquadramento muda**: dados biométricos são sensíveis (LGPD art. 5º, II), o critério do art. 4º, II, 'd' pode se configurar e a dispensa de encarregado deixa de ser segura. Nesse caso, indicar encarregado e revalidar a base legal do art. 11.

## Conclusão preliminar

O controlador **aparenta se enquadrar** como agente de tratamento de pequeno porte (Res. 2/2022, art. 2º, I) e, por isso, **pode manter a dispensa de encarregado**, desde que:

1. o canal de comunicação com o titular continue disponível e identificado (art. 11, §1º) — **já está**;
2. a declaração abaixo, assinada em 22/11/2026, continue guardada no dossiê;
3. nenhum dos gatilhos de reavaliação ocorra.

Isto não é autorização para tratar a dispensa como definitiva: o art. 16 permite que a ANPD exija o cumprimento da obrigação dispensada.

## Termo de declaração (preencher e assinar)

> **DECLARAÇÃO DE ENQUADRAMENTO COMO AGENTE DE TRATAMENTO DE PEQUENO PORTE**
>
> Eu, **Artur Fernandes Macêdo Vinhas**, controlador do serviço LaudoRápido, declaro para os fins da Resolução CD/ANPD nº 2/2022 que:
>
> - atuo como pessoa natural e assumo as obrigações de controlador dos dados tratados no serviço;
> - não aufiro receita bruta acima dos limites previstos no art. 3º, II, da referida resolução;
> - não pertenço a grupo econômico cuja receita global ultrapasse esses limites;
> - não realizo tratamento de alto risco nos termos do art. 4º da resolução, estando ciente de que fotos e assinaturas são usadas apenas como registro documental da visita, sem reconhecimento biométrico automatizado;
> - mantenho o canal de comunicação com titulares em **[CONTATO]**, para atender o art. 41, §2º, I, da LGPD;
> - comunicarei à ANPD qualquer mudança que me retire do enquadramento.
>
> Local/Data: ______________________
>
> Assinatura: ______________________

## Gatilhos de reavaliação — pare e refaça esta análise se ocorrer

- [ ] Começar a cobrar pelo serviço ou ultrapassar limite de ME/EPP / startup.
- [ ] Entrar em grupo econômico com receita acima do limite.
- [ ] Usar biometria para identificar pessoas, ou tratar dados de saúde, crianças ou idosos.
- [ ] Passar a tomar decisões automatizadas com perfilamento.
- [ ] Atingir volume que configure larga escala.
- [ ] A ANPD determinar o cumprimento da obrigação dispensada (art. 16).
