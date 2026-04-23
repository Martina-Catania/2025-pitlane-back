-- CreateEnum
CREATE TYPE "public"."GameType" AS ENUM ('egg_clicker', 'roulette');

-- CreateEnum
CREATE TYPE "public"."GameStatus" AS ENUM ('waiting', 'ready', 'countdown', 'playing', 'submitting', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "public"."gamesession" (
    "GameSessionID" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "gameType" "public"."GameType" NOT NULL,
    "status" "public"."GameStatus" NOT NULL DEFAULT 'waiting',
    "hostId" UUID NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "winnerId" UUID,
    "winningMealId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gamesession_pkey" PRIMARY KEY ("GameSessionID")
);

-- CreateTable
CREATE TABLE "public"."gameparticipant" (
    "GameParticipantID" SERIAL NOT NULL,
    "gameSessionId" INTEGER NOT NULL,
    "profileId" UUID NOT NULL,
    "mealId" INTEGER,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "hasSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),

    CONSTRAINT "gameparticipant_pkey" PRIMARY KEY ("GameParticipantID")
);

-- CreateIndex
CREATE UNIQUE INDEX "gameparticipant_gameSessionId_profileId_key" ON "public"."gameparticipant"("gameSessionId", "profileId");

-- AddForeignKey
ALTER TABLE "public"."gamesession" ADD CONSTRAINT "gamesession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."group"("GroupID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gamesession" ADD CONSTRAINT "gamesession_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gamesession" ADD CONSTRAINT "gamesession_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "public"."profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gamesession" ADD CONSTRAINT "gamesession_winningMealId_fkey" FOREIGN KEY ("winningMealId") REFERENCES "public"."meal"("MealID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gameparticipant" ADD CONSTRAINT "gameparticipant_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "public"."gamesession"("GameSessionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gameparticipant" ADD CONSTRAINT "gameparticipant_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."gameparticipant" ADD CONSTRAINT "gameparticipant_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."meal"("MealID") ON DELETE SET NULL ON UPDATE CASCADE;
