ALTER TYPE "public"."transaction_origin" ADD VALUE 'reimbursement';--> statement-breakpoint
ALTER TABLE "person_settlements" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "person_settlements" CASCADE;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD COLUMN "is_guaranteed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "is_guaranteed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reimbursement_due_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reimbursement_source_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reimbursement_series_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reimbursement_occurrence_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reimbursement_period" varchar(7);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reimbursement_expense_due_date" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "reimbursement_customized" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "parent_transaction_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reimbursement_source_user_fk" FOREIGN KEY ("reimbursement_source_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reimbursement_series_user_fk" FOREIGN KEY ("reimbursement_series_id","user_id") REFERENCES "public"."recurring_transaction_series"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_parent_user_fk" FOREIGN KEY ("parent_transaction_id","user_id") REFERENCES "public"."transactions"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_reimbursement_source_person_unique" ON "transactions" USING btree ("reimbursement_source_id","person_id") WHERE "transactions"."reimbursement_source_id" IS NOT NULL AND "transactions"."parent_transaction_id" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_reimbursement_occurrence_person_unique" ON "transactions" USING btree ("reimbursement_series_id","reimbursement_occurrence_date","person_id") WHERE "transactions"."reimbursement_series_id" IS NOT NULL AND "transactions"."parent_transaction_id" IS NULL;--> statement-breakpoint
CREATE INDEX "transactions_parent_transaction_idx" ON "transactions" USING btree ("parent_transaction_id") WHERE "transactions"."parent_transaction_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_reimbursement_occurrence_check" CHECK (("transactions"."reimbursement_series_id" IS NULL) = ("transactions"."reimbursement_occurrence_date" IS NULL) AND ("transactions"."reimbursement_series_id" IS NULL OR "transactions"."reimbursement_source_id" IS NULL) AND ("transactions"."reimbursement_period" IS NOT NULL) = ("transactions"."reimbursement_series_id" IS NOT NULL OR "transactions"."reimbursement_source_id" IS NOT NULL));--> statement-breakpoint
-- "Reembolso" passa a ser a categoria fixa dos reembolsos, mantendo os lançamentos que já tinha.
UPDATE "categories" SET "is_system" = true, "updated_at" = now()
WHERE "name" = 'Reembolso' AND "type" = 'income' AND "parent_id" IS NULL AND NOT "is_system"
  AND NOT EXISTS (SELECT 1 FROM "categories" "child" WHERE "child"."parent_id" = "categories"."id");--> statement-breakpoint
INSERT INTO "categories" ("user_id", "name", "type", "icon", "is_system")
SELECT "user"."id", 'Reembolso', 'income', 'refresh-cw', true FROM "user"
WHERE NOT EXISTS (
  SELECT 1 FROM "categories"
  WHERE "categories"."user_id" = "user"."id" AND "categories"."name" = 'Reembolso'
    AND "categories"."type" = 'income' AND "categories"."parent_id" IS NULL
);--> statement-breakpoint
-- A categoria dos antigos repasses só permanece para quem chegou a usá-la.
DELETE FROM "categories" WHERE "is_system" AND "type" = 'income' AND "name" = 'Repasses'
  AND NOT EXISTS (SELECT 1 FROM "transactions" WHERE "transactions"."category_id" = "categories"."id")
  AND NOT EXISTS (SELECT 1 FROM "recurring_transaction_rules" WHERE "recurring_transaction_rules"."category_id" = "categories"."id");--> statement-breakpoint
-- O estorno da loja deixa de se chamar reembolso, que agora é o que outra pessoa devolve.
UPDATE "transactions" SET "name" = 'Estorno · ' || substr("name", length('Reembolso · ') + 1)
WHERE "origin" = 'refund' AND "name" LIKE 'Reembolso · %';
