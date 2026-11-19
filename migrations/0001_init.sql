-- 0001_init.sql — schema inicial do LaudoRápido.
-- Migrações são imutáveis: mudanças futuras entram em arquivos novos (0002, 0003, ...).

CREATE TYPE "public"."status_visita" AS ENUM('rascunho', 'sincronizada', 'entregue');

CREATE TABLE "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp DEFAULT now()
);

CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);

CREATE TABLE "modelos_visita" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"campos" jsonb NOT NULL
);

CREATE TABLE "visitas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"empresa_id" uuid NOT NULL,
	"modelo_id" uuid,
	"client_id" uuid NOT NULL,
	"status" "status_visita" DEFAULT 'rascunho' NOT NULL,
	"dados" jsonb NOT NULL,
	"token" text,
	"capturado_em" timestamp NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "visitas_token_unique" UNIQUE("token")
);

CREATE TABLE "fotos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visita_id" uuid NOT NULL,
	"url" text NOT NULL,
	"capturado_em" timestamp NOT NULL
);

CREATE TABLE "assinaturas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"visita_id" uuid NOT NULL,
	"url" text NOT NULL,
	"criado_em" timestamp DEFAULT now(),
	CONSTRAINT "assinaturas_visita_id_unique" UNIQUE("visita_id")
);

ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "modelos_visita" ADD CONSTRAINT "modelos_visita_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "visitas" ADD CONSTRAINT "visitas_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "visitas" ADD CONSTRAINT "visitas_modelo_id_modelos_visita_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."modelos_visita"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "fotos" ADD CONSTRAINT "fotos_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "assinaturas" ADD CONSTRAINT "assinaturas_visita_id_visitas_id_fk" FOREIGN KEY ("visita_id") REFERENCES "public"."visitas"("id") ON DELETE cascade ON UPDATE no action;

CREATE UNIQUE INDEX "visitas_empresa_id_client_id_unique" ON "visitas" USING btree ("empresa_id","client_id");
