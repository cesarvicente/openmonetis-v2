ALTER TABLE "inbox_items" DROP CONSTRAINT "inbox_items_discard_reason_check";--> statement-breakpoint
ALTER TABLE "inbox_rules" DROP CONSTRAINT "inbox_rules_actions_required_check";--> statement-breakpoint
ALTER TABLE "inbox_rules" ADD COLUMN "action" varchar(20) DEFAULT 'fill' NOT NULL;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_discard_reason_check" CHECK ("inbox_items"."discard_reason" IS NULL OR ("inbox_items"."status" = 'discarded' AND "inbox_items"."discard_reason" in ('duplicate', 'rule')));--> statement-breakpoint
ALTER TABLE "inbox_rules" ADD CONSTRAINT "inbox_rules_actions_required_check" CHECK ((
        "inbox_rules"."action" = 'fill'
        AND ("inbox_rules"."transaction_type" is not null or "inbox_rules"."category_id" is not null or "inbox_rules"."person_id" is not null or "inbox_rules"."payment_method" is not null)
      ) OR (
        "inbox_rules"."action" = 'discard'
        AND "inbox_rules"."transaction_type" is null
        AND "inbox_rules"."category_id" is null
        AND "inbox_rules"."person_id" is null
        AND "inbox_rules"."payment_method" is null
      ));