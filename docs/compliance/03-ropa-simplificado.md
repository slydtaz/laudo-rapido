# 03 — Registro das operações de tratamento (ROPA simplificado)

**Base:** LGPD art. 37; Res. CD/ANPD nº 2/2022, art. 9º (forma simplificada permitida a agentes de pequeno porte).
**Finalidade:** registrar o que é tratado, por quê, com qual base legal, por quanto tempo e com quais operadores.

**Atualizado em:** 22/11/2026
**Controlador:** Artur Fernandes Macêdo Vinhas — pessoa física, sem CNPJ informado.

## Bases legais usadas (LGPD art. 7º)

- **II** — cumprimento de obrigação legal ou regulatória.
- **V** — execução de contrato ou procedimentos preliminares, a pedido do titular.
- **IX** — interesses legítimos do controlador, desde que não prevaleçam direitos e liberdades fundamentais do titular.

Não há tratamento baseado em consentimento nesta versão, porque não há cookie não essencial, analytics, pixel ou publicidade.

## Registro de operações

| # | Operação | Dados pessoais | Titulares | Base (art. 7º) | Finalidade | Operadores | Retenção | Observações |
|---|---|---|---|---|---|---|---|---|
| 1 | Cadastro e conta | e-mail, nome, hash Argon2 da senha, `googleSub`, `emailVerificadoEm` | Usuário técnico (empresa cliente) | V | Autenticar e manter a conta | Supabase, Vercel, Google (controlador de identidade — não operador) | Enquanto a conta estiver ativa ou até pedido de exclusão | Senha nunca em texto puro |
| 2 | Sessão autenticada | cookie opaco `sessao` → `usuarioId`, `empresaId` | Usuário técnico | V | Manter login | Supabase, Vercel | 7 dias (`DURACAO_SESSAO_SEGUNDOS`) | `HttpOnly`, `SameSite=Lax`, `Secure` em produção |
| 3 | Fluxo OAuth do Google | cookie `oauth` (`state`, `verifier`), `sub` do Google | Usuário técnico | V | Concluir autenticação sem CSRF | Google (controlador de identidade), Vercel | 10 minutos | PKCE; a Google não é operadora no Gmail pessoal |
| 4 | E-mail transacional | e-mail, hash do token de verificação/redefinição | Usuário técnico | V | Verificar e-mail e redefinir senha | Make (webhook), Supabase | Conforme `expiraEm`; uso único; `usadoEm` registrado | O token é persistido só como hash |
| 5 | Proteção contra abuso de login | chave opaca derivada de IP + e-mail, contador | Quem tenta login | IX | Limitar tentativas e prevenir fraude | Supabase, Vercel | Janela ativa de 15 minutos; **registro persistido sem expurgo automático** | Base IX documentada: segurança e prevenção a fraude. Ver item "Ajustes de retenção" |
| 6 | Registro de visita | `dados` (nome do cliente, tipo, observações, data), `status`, `token` opaco, `clientId` | Cliente do técnico (pessoa identificada ou identificável) | V | Registrar a visita e gerar o laudo | Supabase, Vercel | Enquanto a conta estiver ativa ou até pedido de exclusão | Consultas escopadas por `empresaId` |
| 7 | Modelo de visita | `nome`, `campos` (configuração do formulário) | — (configuração, sem dado de titular em si) | V | Definir o que é coletado em cada visita | Supabase, Vercel | Enquanto a conta estiver ativa | — |
| 8 | Fotos da visita | arquivo de imagem + URL pública no R2, `capturadoEm` | Cliente do técnico | V | Comprovar visualmente a visita no laudo | Cloudflare R2, Supabase, Vercel | Enquanto a conta estiver ativa ou até pedido de exclusão | URL pública; a política alerta para compartilhar o link só com o destinatário |
| 9 | Assinatura do laudo | arquivo de imagem + URL pública no R2, `criadoEm` | Cliente do técnico / prestador | V | Registrar manifestação no laudo | Cloudflare R2, Supabase, Vercel | Enquanto a conta estiver ativa ou até pedido de exclusão | Uso documental; sem reconhecimento biométrico automatizado |
| 10 | Entrega pública do laudo | token opaco da URL `/o/:token`, dados da visita e mídia no PDF | Destinatário do laudo | V | Entregar o PDF sem expor identificadores na URL | Vercel, Supabase, Cloudflare R2 | Enquanto a visita existir; **sem expiração de token implementada** | O token é a credencial. Ver "Ajustes de retenção" |
| 11 | Preferências locais | tema, idioma, movimento, sincronização automática, tamanho de texto | Usuário técnico | IX (usabilidade) | Guardar preferência no próprio aparelho | Nenhum (sem transmissão ao servidor) | Até o usuário limpar o dispositivo | Service worker não guarda dados em cache offline |
| 12 | Atendimento a titular / exercício de direitos | e-mail e dados necessários à solicitação | Titular | II | Cumprir LGPD art. 18 e responder em prazo legal | Provedor de e-mail | Registro mínimo do atendimento; prazo de resposta: imediato na forma simplificada ou até 15 dias na declaração clara e completa (art. 19) | Canal: `CONTATO` em `src/lib/legal/conteudo.ts`; operador identificado em 22/11/2026: Make (webhook) |

## Compartilhamento e transferência

- **Não há venda, publicidade ou perfilamento.**
- Operadores identificados em 22/11/2026: Supabase (banco), Vercel (hospedagem), Cloudflare R2 (mídia), Make/Celonis (e-mail) e Google. A Google atua como **controladora de identidade independente**, não como operadora do LaudoRápido: o serviço recebe nome/e-mail/`sub` após autorização do usuário e não envia dados dos clientes à Google como operadora. Fonte oficial: https://support.google.com/legal-help-center/answer/13885940?hl=en
- O detalhamento de transferência internacional e os documentos arquivados estão em [01-transferencia-internacional.md](./01-transferencia-internacional.md) e [contratos/README.md](./contratos/README.md).
- Mídia com URL pública é acessível a quem receber a URL — risco comunicado na política de privacidade.

## Ajustes de retenção identificados (não são infração, são melhoria)

1. **Contadores de login (`tentativas_login`):** a janela de bloqueio é de 15 minutos, mas o registro persistido não tem rotina automática de expurgo. Definir uma rotina manual ou job de limpeza (por exemplo, apagar registros com `criadoEm` antigo) e anotar aqui a periodicidade.
2. **Token de entrega (`visitas.token`):** não há expiração. Não é obrigatório por lei, mas reduziria o risco de link vazado. Se for implementado, ajustar a política e este ROPA no mesmo commit (regra do `AGENTS.md`).

## Revisão

Revisar este registro sempre que o checklist do `AGENTS.md` acusar mudança em dados, finalidade, base legal, operador, retenção ou texto legal. A versão simplificada é permitida enquanto o enquadramento de pequeno porte se mantiver (ver [02](./02-enquadramento-pequeno-porte.md)).
