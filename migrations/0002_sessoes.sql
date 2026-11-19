-- 0002_sessoes.sql — sessões autenticadas do LaudoRápido.
-- O `id` é o token opaco (base64url) entregue no cookie `sessao`.
-- Sem FKs: a sessão é uma credencial, não um vínculo do domínio.

CREATE TABLE "sessoes" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" text NOT NULL,
	"empresa_id" text NOT NULL,
	"expira_em" timestamp NOT NULL,
	"criado_em" timestamp DEFAULT now()
);
