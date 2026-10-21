ALTER TABLE "recurring_transaction_rules" ADD COLUMN "recurrence_end_date" date;
--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD CONSTRAINT "recurring_transaction_rules_deadline_check" CHECK ("recurring_transaction_rules"."recurrence_end_date" is null or "recurring_transaction_rules"."recurrence_end_date" >= "recurring_transaction_rules"."anchor_date");
