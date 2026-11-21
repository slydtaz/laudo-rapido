-- 0005_configuracao_app.sql — sobrescritas de texto e planos do editor.
-- Uma única linha (chave = 'app') guarda o JSON da configuração do aplicativo.

CREATE TABLE "configuracao_app" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" jsonb NOT NULL,
	"atualizado_em" timestamp NOT NULL DEFAULT now()
);
