/*
  Warnings:

  - You are about to drop the column `mealPortionId` on the `foodportion` table. All the data in the column will be lost.
  - You are about to drop the `consumption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `consumptionmeal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `mealportion` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[mealConsumptionId,foodId]` on the table `foodportion` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `mealConsumptionId` to the `foodportion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."BadgeType" ADD VALUE 'game_clicker_winner';
ALTER TYPE "public"."BadgeType" ADD VALUE 'game_roulette_winner';

-- AlterEnum
ALTER TYPE "public"."ConsumptionSource" ADD VALUE 'group';

-- DropForeignKey
ALTER TABLE "public"."consumption" DROP CONSTRAINT "consumption_groupId_fkey";

-- DropForeignKey
ALTER TABLE "public"."consumption" DROP CONSTRAINT "consumption_profileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."consumptionmeal" DROP CONSTRAINT "consumptionmeal_consumptionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."consumptionmeal" DROP CONSTRAINT "consumptionmeal_mealId_fkey";

-- DropForeignKey
ALTER TABLE "public"."consumptionmeal" DROP CONSTRAINT "consumptionmeal_mealPortionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."foodportion" DROP CONSTRAINT "foodportion_mealPortionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mealportion" DROP CONSTRAINT "mealportion_gameSessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mealportion" DROP CONSTRAINT "mealportion_mealId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mealportion" DROP CONSTRAINT "mealportion_profileId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mealportion" DROP CONSTRAINT "mealportion_votingSessionId_fkey";

-- DropIndex
DROP INDEX "public"."foodportion_mealPortionId_foodId_key";

-- AlterTable
ALTER TABLE "public"."foodportion" DROP COLUMN "mealPortionId",
ADD COLUMN     "mealConsumptionId" INTEGER NOT NULL;

-- DropTable
DROP TABLE "public"."consumption";

-- DropTable
DROP TABLE "public"."consumptionmeal";

-- DropTable
DROP TABLE "public"."mealportion";

-- CreateTable
CREATE TABLE "public"."mealconsumption" (
    "MealConsumptionID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "profileId" UUID NOT NULL,
    "mealId" INTEGER NOT NULL,
    "groupId" INTEGER,
    "source" "public"."ConsumptionSource" NOT NULL DEFAULT 'individual',
    "votingSessionId" INTEGER,
    "gameSessionId" INTEGER,
    "portionFraction" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalKcal" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mealconsumption_pkey" PRIMARY KEY ("MealConsumptionID")
);

-- CreateIndex
CREATE UNIQUE INDEX "foodportion_mealConsumptionId_foodId_key" ON "public"."foodportion"("mealConsumptionId", "foodId");

-- AddForeignKey
ALTER TABLE "public"."mealconsumption" ADD CONSTRAINT "mealconsumption_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealconsumption" ADD CONSTRAINT "mealconsumption_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."meal"("MealID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealconsumption" ADD CONSTRAINT "mealconsumption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."group"("GroupID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealconsumption" ADD CONSTRAINT "mealconsumption_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealconsumption" ADD CONSTRAINT "mealconsumption_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "public"."gamesession"("GameSessionID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."foodportion" ADD CONSTRAINT "foodportion_mealConsumptionId_fkey" FOREIGN KEY ("mealConsumptionId") REFERENCES "public"."mealconsumption"("MealConsumptionID") ON DELETE CASCADE ON UPDATE CASCADE;
