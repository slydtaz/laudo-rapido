-- 0004_tentativas_login.sql — contador de tentativas de login e recuperação.
-- A chave é opaca (IP + e-mail normalizados): nenhum segredo é gravado aqui.
-- A janela é reiniciada quando a primeira tentativa registrada expira.

CREATE TABLE "tentativas_login" (
	"chave" text PRIMARY KEY NOT NULL,
	"tentativas" integer NOT NULL DEFAULT 0,
	"criado_em" timestamp NOT NULL DEFAULT now()
);
