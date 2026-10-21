CREATE TABLE "due_date_rule_versions" (
	"user_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"effective_from" date NOT NULL,
	"calendar" jsonb NOT NULL,
	"rules" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "due_date_rule_versions_user_id_revision_pk" PRIMARY KEY("user_id","revision"),
	CONSTRAINT "due_date_rule_versions_revision_check" CHECK ("due_date_rule_versions"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "original_due_date" date;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN "due_date_rule_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_transaction_occurrences" ADD COLUMN "frozen_due_date" date;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" ADD COLUMN "due_date_rule_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "due_date_rule_excluded" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "frozen_due_date" date;--> statement-breakpoint
ALTER TABLE "due_date_rule_versions" ADD CONSTRAINT "due_date_rule_versions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_transaction_rules" DROP COLUMN "recurrence_schedule";