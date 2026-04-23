/*
  Warnings:

  - You are about to drop the column `participantId` on the `mealportion` table. All the data in the column will be lost.
  - Added the required column `profileId` to the `mealportion` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."ConsumptionSource" AS ENUM ('individual', 'voting', 'game');

-- DropForeignKey
ALTER TABLE "public"."mealportion" DROP CONSTRAINT "mealportion_participantId_fkey";

-- AlterTable
ALTER TABLE "public"."mealportion" DROP COLUMN "participantId",
ADD COLUMN     "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "gameSessionId" INTEGER,
ADD COLUMN     "profileId" UUID NOT NULL,
ADD COLUMN     "source" "public"."ConsumptionSource" NOT NULL DEFAULT 'individual',
ADD COLUMN     "votingSessionId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."mealportion" ADD CONSTRAINT "mealportion_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealportion" ADD CONSTRAINT "mealportion_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealportion" ADD CONSTRAINT "mealportion_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "public"."gamesession"("GameSessionID") ON DELETE CASCADE ON UPDATE CASCADE;
