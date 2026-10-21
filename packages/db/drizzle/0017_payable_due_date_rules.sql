-- Broaden the existing due-date policy to all payables; keep selections and revision order.
UPDATE "due_date_rule_versions" AS version
SET "rules" = (
  SELECT jsonb_agg(
    CASE WHEN rule->>'target' = 'boleto'
      THEN jsonb_set(rule, '{target}', '"payable"'::jsonb)
      ELSE rule
    END ORDER BY position
  )
  FROM jsonb_array_elements(version."rules") WITH ORDINALITY AS items(rule, position)
)
WHERE EXISTS (
  SELECT 1 FROM jsonb_array_elements(version."rules") AS rule
  WHERE rule->>'target' = 'boleto'
);
