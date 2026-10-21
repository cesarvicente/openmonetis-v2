CREATE TABLE "recurring_transaction_rule_tags" (
	"user_id" uuid NOT NULL,
	"recurring_rule_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "recurring_transaction_rule_tags_recurring_rule_id_tag_id_pk" PRIMARY KEY("recurring_rule_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"name_key" varchar(80) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_not_blank_check" CHECK (btrim("tags"."name") <> '')
);
--> statement-breakpoint
CREATE TABLE "transaction_tags" (
	"user_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "transaction_tags_transaction_id_tag_id_pk" PRIMARY KEY("transaction_id","tag_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tags_id_user_id_unique" ON "tags" USING btree ("id","user_id");--> statement-breakpoint
ALTER TABLE "recurring_transaction_rule_tags" ADD CONSTRAINT "recurring_transaction_rule_tags_recurring_rule_id_user_id_recurring_transaction_rules_id_user_id_fk" FOREIGN KEY ("recurring_rule_id","user_id") REFERENCES "public"."recurring_transaction_rules"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rule_tags" ADD CONSTRAINT "recurring_transaction_rule_tags_tag_id_user_id_tags_id_user_id_fk" FOREIGN KEY ("tag_id","user_id") REFERENCES "public"."tags"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_transaction_id_user_id_transactions_id_user_id_fk" FOREIGN KEY ("transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_tags" ADD CONSTRAINT "transaction_tags_tag_id_user_id_tags_id_user_id_fk" FOREIGN KEY ("tag_id","user_id") REFERENCES "public"."tags"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "recurring_rule_tags_user_tag_idx" ON "recurring_transaction_rule_tags" USING btree ("user_id","tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_user_name_key_unique" ON "tags" USING btree ("user_id","name_key");--> statement-breakpoint
CREATE INDEX "transaction_tags_user_tag_idx" ON "transaction_tags" USING btree ("user_id","tag_id");