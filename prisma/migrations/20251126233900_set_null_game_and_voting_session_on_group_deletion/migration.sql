-- DropForeignKey
ALTER TABLE "public"."mealportion" DROP CONSTRAINT "mealportion_gameSessionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."mealportion" DROP CONSTRAINT "mealportion_votingSessionId_fkey";

-- AddForeignKey
ALTER TABLE "public"."mealportion" ADD CONSTRAINT "mealportion_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealportion" ADD CONSTRAINT "mealportion_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "public"."gamesession"("GameSessionID") ON DELETE SET NULL ON UPDATE CASCADE;
