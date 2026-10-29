CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"key_digest" varchar(64) NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_name_not_blank_check" CHECK (btrim("api_keys"."name") <> ''),
	CONSTRAINT "api_keys_expiration_check" CHECK ("api_keys"."expires_at" is null or "api_keys"."expires_at" > "api_keys"."created_at")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_digest_unique" ON "api_keys" USING btree ("key_digest");--> statement-breakpoint
CREATE INDEX "api_keys_user_id_created_at_idx" ON "api_keys" USING btree ("user_id","created_at");