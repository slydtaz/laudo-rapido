-- 0003_auth.sql — campos de autenticação externa e tokens de uso único.
-- Aditivo: nenhuma coluna ou tabela existente é alterada ou removida.

ALTER TABLE "usuarios" ADD COLUMN "nome" text;
ALTER TABLE "usuarios" ADD COLUMN "google_sub" text;
ALTER TABLE "usuarios" ADD COLUMN "email_verificado_em" timestamp;

-- Vários usuários podem não ter Google; o índice único ignora nulos.
CREATE UNIQUE INDEX "usuarios_google_sub_unique" ON "usuarios" ("google_sub");

CREATE TABLE "tokens_auth" (
	"id" text PRIMARY KEY NOT NULL,
	"usuario_id" uuid NOT NULL REFERENCES "usuarios" ("id") ON DELETE CASCADE,
	"tipo" text NOT NULL CHECK ("tipo" IN ('verificar_email', 'redefinir_senha')),
	"expira_em" timestamp NOT NULL,
	"usado_em" timestamp,
	"criado_em" timestamp NOT NULL DEFAULT now()
);
