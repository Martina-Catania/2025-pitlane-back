-- Ensure sentinel dietary restriction exists for frontend/backend logic
-- ID 0 means "For Everyone"
INSERT INTO "public"."dietaryrestriction" ("DietaryRestrictionID", "name")
VALUES (0, 'For Everyone')
ON CONFLICT ("DietaryRestrictionID") DO UPDATE
SET "name" = EXCLUDED."name";

-- Keep SERIAL sequence in sync after explicit ID insertion
SELECT setval(
  pg_get_serial_sequence('"public"."dietaryrestriction"', 'DietaryRestrictionID'),
  GREATEST(COALESCE((SELECT MAX("DietaryRestrictionID") FROM "public"."dietaryrestriction"), 1), 1),
  true
);
