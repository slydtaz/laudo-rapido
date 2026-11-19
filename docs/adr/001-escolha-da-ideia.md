# ADR-001: Escolha da ideia — LaudoRápido (antigo "Fieldnote")

**Status:** Aceito  
**Data:** 2026-11-18

## Contexto

Foram avaliadas oito ideias para uma primeira startup operada por uma pessoa, com orçamento mínimo e prazo de 4–6 semanas. Os critérios foram dor real, disposição de pagamento, facilidade do MVP, custo operacional e defensibilidade.

A opção inicialmente chamada "Fieldnote" gerou confusão: o nome sugeria um bloco de notas de lembretes, quando o produto é um laudo/ordem de serviço digital. O nome foi trocado para **LaudoRápido**.

## Decisão

Adotar **LaudoRápido** como primeira aposta. O produto registra visitas técnicas com fotos e assinatura do cliente e gera um PDF entregue no ato, com funcionamento offline.

## Alternativas consideradas

1. **OrçaFácil** (orçamento com aceite digital) — MVP mais simples e ciclo de venda curto, porém concorrência mais acirrada. Mantido como aposta 2.
2. **ContaFácil** (conciliação p/ contadores) — ticket maior, mas integração bancária e compliance atrasariam meses. Rejeitada.
3. **BolsaVencendo** (lembretes de vencimento B2C) — CAC alto e dados sensíveis. Rejeitada.
4. **ErroClaro** (diagnóstico de stack traces) — custo baixo, mas público dev paga mal. Rejeitada.
5. **EstoqueBot**, **Agendinha Pro**, **Pdf2Trilha** — score menor na avaliação comparativa. Rejeitadas.

## Consequências

- **Positivas:** dor concreta e recorrente; valor percebido imediato; o offline é ao mesmo tempo benefício e barreira de cópia; PDF e assinatura são reutilizáveis na aposta 2.
- **Negativas:** sincronização otimista é a parte tecnicamente mais difícil; exige venda ativa a técnicos e canais indiretos (distribuidoras, contadores).

## Ajuste de escopo

A crítica mais provável — "é só um bloco de notas" — é tratada na comunicação do produto: o artefato entregue é um **PDF formal com assinatura**, não uma anotação pessoal.
