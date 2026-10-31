ALTER TABLE "inbox_rules" DROP CONSTRAINT "inbox_rules_payment_target_check";--> statement-breakpoint
ALTER TABLE "inbox_rules" ADD CONSTRAINT "inbox_rules_payment_target_check" CHECK ((
        "inbox_rules"."payment_method" is null
        AND "inbox_rules"."card_id" is null
        AND "inbox_rules"."account_id" is null
      ) OR (
        "inbox_rules"."payment_method" = 'credit_card'
        AND "inbox_rules"."account_id" is null
      ) OR (
        "inbox_rules"."payment_method" <> 'credit_card'
        AND "inbox_rules"."card_id" is null
      ));