-- CreateTable
CREATE TABLE "public"."mealfood" (
    "MealFoodID" SERIAL NOT NULL,
    "mealId" INTEGER NOT NULL,
    "foodId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "mealfood_pkey" PRIMARY KEY ("MealFoodID")
);

-- AlterTable
ALTER TABLE "public"."food"
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "profileId" UUID;

-- Ensure a fallback profile exists for legacy foods created before profileId was introduced.
INSERT INTO "public"."profile" ("id", "role")
VALUES ('00000000-0000-0000-0000-000000000001', 'admin')
ON CONFLICT ("id") DO NOTHING;

-- Backfill existing foods so NOT NULL can be applied safely.
UPDATE "public"."food"
SET "profileId" = '00000000-0000-0000-0000-000000000001'
WHERE "profileId" IS NULL;

ALTER TABLE "public"."food"
ALTER COLUMN "profileId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "mealfood_mealId_foodId_key" ON "public"."mealfood"("mealId", "foodId");

-- AddForeignKey
ALTER TABLE "public"."food" ADD CONSTRAINT "food_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealfood" ADD CONSTRAINT "mealfood_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."meal"("MealID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealfood" ADD CONSTRAINT "mealfood_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "public"."food"("FoodID") ON DELETE CASCADE ON UPDATE CASCADE;