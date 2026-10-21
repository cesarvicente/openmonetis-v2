DROP INDEX "categories_user_id_name_type_unique";--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_id_parent_name_type_unique" ON "categories" USING btree ("user_id","parent_id","name","type") WHERE "categories"."parent_id" is not null;--> statement-breakpoint
CREATE INDEX "categories_user_id_parent_idx" ON "categories" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_id_user_id_type_unique" ON "categories" USING btree ("id","user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_user_id_name_type_unique" ON "categories" USING btree ("user_id","name","type") WHERE "categories"."parent_id" is null;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_check" CHECK ("categories"."parent_id" is null or ("categories"."parent_id" <> "categories"."id" and not "categories"."is_system"));--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_owner_type_fk" FOREIGN KEY ("parent_id","user_id","type") REFERENCES "public"."categories"("id","user_id","type") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION enforce_category_hierarchy() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Serialize hierarchy changes per owner, including writes made outside the API.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text, 0));
  IF NEW.parent_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM categories p WHERE p.id = NEW.parent_id AND p.user_id = NEW.user_id
      AND p.type = NEW.type AND p.parent_id IS NULL AND NOT p.is_system AND p.id <> NEW.id) THEN
      RAISE EXCEPTION 'Invalid category parent' USING ERRCODE = '23514', CONSTRAINT = 'categories_hierarchy_check';
    END IF;
    IF EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = NEW.id AND c.user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'Category has children' USING ERRCODE = '23514', CONSTRAINT = 'categories_children_check';
    END IF;
  END IF;
  IF NEW.is_system AND EXISTS (SELECT 1 FROM categories c WHERE c.parent_id = NEW.id AND c.user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'System category has children' USING ERRCODE = '23514', CONSTRAINT = 'categories_children_check';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER categories_hierarchy_trigger BEFORE INSERT OR UPDATE OF parent_id, type, is_system ON categories
FOR EACH ROW EXECUTE FUNCTION enforce_category_hierarchy();
