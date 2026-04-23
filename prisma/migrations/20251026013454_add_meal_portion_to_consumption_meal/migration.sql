-- DropIndex
DROP INDEX "public"."mealportion_participantId_mealId_key";

-- AlterTable
ALTER TABLE "public"."consumptionmeal" ADD COLUMN     "mealPortionId" INTEGER;

-- AlterTable
ALTER TABLE "public"."mealportion" ALTER COLUMN "participantId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."consumptionmeal" ADD CONSTRAINT "consumptionmeal_mealPortionId_fkey" FOREIGN KEY ("mealPortionId") REFERENCES "public"."mealportion"("MealPortionID") ON DELETE SET NULL ON UPDATE CASCADE;
