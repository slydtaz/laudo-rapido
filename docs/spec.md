# Especificação: LaudoRápido

## Visão

Técnicos de campo (HVAC, elétrica, manutenção predial, ar-condicionado) preenchem relatórios no papel ou no Word depois da visita. O LaudoRápido substitui isso por um formulário no celular/tablet que funciona offline, captura fotos e a assinatura do cliente e gera um PDF entregue na hora.

**Diferencial:** funcionar sem sinal (porão, garagem, área industrial) e entregar o documento antes de sair do local.

## Usuários

| Ator | O que faz |
|------|-----------|
| Técnico | Preenche a visita, fotografa, pede assinatura |
| Empresa (admin) | Cria modelos de visita, acompanha relatórios |
| Cliente final | Abre link público, vê o laudo, baixa o PDF |

## Requisitos funcionais

- **RF-01** Criar modelos de visita com campos configuráveis por tipo de serviço.
- **RF-02** Iniciar uma visita, preencher campos e anexar fotos **sem internet**.
- **RF-03** Sincronizar visitas em lote quando a conexão voltar, de forma idempotente.
- **RF-04** Capturar assinatura do cliente por canvas e anexá-la ao laudo.
- **RF-05** Gerar PDF com dados da visita, fotos, assinatura, data e identificação do prestador.
- **RF-06** Compartilhar o laudo por link público (token opaco, sem login).
- **RF-07** Autenticar técnicos/admin por sessão httpOnly.
- **RF-08** Isolar dados por empresa (multitenancy).

## Requisitos não funcionais

- **RNF-01** PWA instalável; fila offline persistida em IndexedDB até confirmação do servidor.
- **RNF-02** Nenhuma foto ou assinatura pode ser perdida durante a sincronização.
- **RNF-03** Link público deve responder < 1s (SSR).
- **RNF-04** Senhas hashed com argon2; sessões em cookie httpOnly + SameSite=Lax.
- **RNF-05** Nenhum secret versionado; `.env.example` documentado.
- **RNF-06** Inferência de IA, se um dia usada, somente cloud-only — nunca modelos locais.

## Escala esperada

| Momento | Empresas | Visitas/mês | Fotos/mês |
|---------|---------:|------------:|----------:|
| Agora | 1 | 50 | 200 |
| 12 meses | 100 | 5.000 | 20.000 |

## Restrições

- Solo founder, orçamento mínimo, MVP em 4–6 semanas.
- Monólito (sem microsserviços).
- Deploy em Vercel; Postgres e storage em free tier no início.
- Sem integração com Open Finance, meios de pagamento ou APIs reguladas no MVP.
- Idioma da interface: português. Nomes de código: inglês.

## Fora de escopo (YAGNI)

- Agendamento, cobrança, GPS, assinatura digital com certificado ICP-Brasil.
- App nativo nas lojas (PWA primeiro).
- Edição colaborativa em tempo real.
- Relatórios analíticos avançados.

## Arquitetura (resumo)

```
[Navegador/Tablet PWA] --> [Next.js + Route Handlers] --> [Postgres]
                                                      --> [R2: fotos e assinaturas]
                                                      --> [Resend: email]
```

### Modelo de dados

```
Empresa 1──* Usuario
Empresa 1──* ModeloVisita
ModeloVisita 1──* Visita
Visita 1──* Foto
Visita 1──1 Assinatura
Visita *──1 Status (rascunho | sincronizada | entregue)
```

### API

```
POST /api/v1/auth/login
POST /api/v1/visitas                 (lote idempotente, chave = client_id)
GET  /api/v1/visitas
POST /api/v1/visitas/:id/fotos
POST /api/v1/visitas/:id/assinar
GET  /api/v1/visitas/:id/pdf
GET  /o/:token                       (público, SSR)
```

## Critérios de aceite do MVP

1. Técnico preenche visita com o Wi-Fi desligado, tira 2 fotos, assina e sincroniza depois.
2. Nenhuma foto duplica se a sincronização for repetida.
3. PDF gerado contém dados, fotos e assinatura legíveis.
4. Cliente abre o link e baixa o PDF sem fazer login.
5. Empresa A nunca vê visitas da empresa B.

Decisões registradas em `docs/adr/`.
