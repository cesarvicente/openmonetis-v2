CREATE TABLE "settlement_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"transaction_id" uuid,
	"recurring_series_id" uuid,
	"occurrence_date" date,
	"action" varchar(16) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN "settled_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN IF NOT EXISTS "settled_date" date;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN "settled_allocations" jsonb;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD COLUMN "recurrence_schedule" jsonb;--> statement-breakpoint
ALTER TABLE "transaction_splits" ADD COLUMN "settled_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "settled_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "settled_date" date;--> statement-breakpoint
ALTER TABLE "settlement_events" ADD CONSTRAINT "settlement_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_events" ADD CONSTRAINT "settlement_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlement_events" ADD CONSTRAINT "settlement_events_recurring_series_id_recurring_transaction_series_id_fk" FOREIGN KEY ("recurring_series_id") REFERENCES "public"."recurring_transaction_series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "settlement_events_user_target_idx" ON "settlement_events" USING btree ("user_id","transaction_id","recurring_series_id");