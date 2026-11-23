-- O nome "Pagamentos" fica livre para categorias do usuário; a de sistema diz o que de fato guarda.
UPDATE "categories" SET "name" = 'Pagamentos de fatura (personalizada)', "updated_at" = now()
WHERE NOT "is_system" AND "parent_id" IS NULL AND "type" = 'expense' AND "name" = 'Pagamentos de fatura';--> statement-breakpoint
UPDATE "categories" SET "name" = 'Pagamentos de fatura', "updated_at" = now()
WHERE "is_system" AND "type" = 'expense' AND "name" = 'Pagamentos';
