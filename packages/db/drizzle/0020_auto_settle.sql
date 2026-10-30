ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN "auto_settled_at" timestamp;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD COLUMN "auto_settle_from" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "auto_settle_from" date;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "auto_settled_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD COLUMN "auto_settle_time" varchar(5) DEFAULT '08:00' NOT NULL;