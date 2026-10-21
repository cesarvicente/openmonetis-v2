ALTER TABLE "recurring_transaction_occurrences" ALTER COLUMN "due_date_rule_excluded" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ALTER COLUMN "due_date_rule_excluded" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date_rule_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date_adjustment" jsonb;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN "due_date_adjustment" jsonb;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "due_date_adjustment" jsonb;
--> statement-breakpoint
-- The old occurrence flag was unused; null now inherits the recurring rule.
UPDATE "recurring_transaction_occurrences" SET "due_date_rule_excluded" = NULL WHERE "due_date_rule_excluded" = false;
