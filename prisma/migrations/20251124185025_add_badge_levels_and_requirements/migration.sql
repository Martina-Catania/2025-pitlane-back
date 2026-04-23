/*
  Warnings:

  - You are about to drop the column `requirements` on the `badge` table. All the data in the column will be lost.
  - You are about to drop the column `maxProgress` on the `userbadge` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."BadgeLevel" AS ENUM ('bronze', 'silver', 'gold', 'diamond');

-- AlterTable
ALTER TABLE "public"."badge" DROP COLUMN "requirements";

-- AlterTable
ALTER TABLE "public"."userbadge" DROP COLUMN "maxProgress",
ADD COLUMN     "currentLevel" "public"."BadgeLevel" NOT NULL DEFAULT 'bronze',
ADD COLUMN     "lastUpgraded" TIMESTAMP(3),
ALTER COLUMN "isCompleted" SET DEFAULT false;

-- CreateTable
CREATE TABLE "public"."badgerequirement" (
    "BadgeRequirementID" SERIAL NOT NULL,
    "badgeId" INTEGER NOT NULL,
    "level" "public"."BadgeLevel" NOT NULL,
    "requiredCount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badgerequirement_pkey" PRIMARY KEY ("BadgeRequirementID")
);

-- CreateIndex
CREATE UNIQUE INDEX "badgerequirement_badgeId_level_key" ON "public"."badgerequirement"("badgeId", "level");

-- AddForeignKey
ALTER TABLE "public"."badgerequirement" ADD CONSTRAINT "badgerequirement_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."badge"("BadgeID") ON DELETE CASCADE ON UPDATE CASCADE;
