/*
  Warnings:

  - You are about to drop the `consumptionfood` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."consumptionfood" DROP CONSTRAINT "consumptionfood_consumptionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."consumptionfood" DROP CONSTRAINT "consumptionfood_foodId_fkey";

-- DropTable
DROP TABLE "public"."consumptionfood";

-- CreateTable
CREATE TABLE "public"."consumptionmeal" (
    "ConsumptionMealID" SERIAL NOT NULL,
    "consumptionId" INTEGER NOT NULL,
    "mealId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "consumptionmeal_pkey" PRIMARY KEY ("ConsumptionMealID")
);

-- CreateIndex
CREATE UNIQUE INDEX "consumptionmeal_consumptionId_mealId_key" ON "public"."consumptionmeal"("consumptionId", "mealId");

-- AddForeignKey
ALTER TABLE "public"."consumptionmeal" ADD CONSTRAINT "consumptionmeal_consumptionId_fkey" FOREIGN KEY ("consumptionId") REFERENCES "public"."consumption"("ConsumptionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumptionmeal" ADD CONSTRAINT "consumptionmeal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."meal"("MealID") ON DELETE CASCADE ON UPDATE CASCADE;
