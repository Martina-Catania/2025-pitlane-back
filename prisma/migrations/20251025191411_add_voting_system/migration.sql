-- CreateEnum
CREATE TYPE "public"."VotingSessionStatus" AS ENUM ('proposal_phase', 'voting_phase', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."VoteType" AS ENUM ('up', 'down');

-- CreateTable
CREATE TABLE "public"."votingsession" (
    "VotingSessionID" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "initiatorId" UUID NOT NULL,
    "status" "public"."VotingSessionStatus" NOT NULL DEFAULT 'proposal_phase',
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "proposalEndsAt" TIMESTAMP(3) NOT NULL,
    "votingEndsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "winnerMealId" INTEGER,
    "totalVotes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "votingsession_pkey" PRIMARY KEY ("VotingSessionID")
);

-- CreateTable
CREATE TABLE "public"."mealproposal" (
    "MealProposalID" SERIAL NOT NULL,
    "votingSessionId" INTEGER NOT NULL,
    "mealId" INTEGER NOT NULL,
    "proposedById" UUID NOT NULL,
    "proposedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voteCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "mealproposal_pkey" PRIMARY KEY ("MealProposalID")
);

-- CreateTable
CREATE TABLE "public"."vote" (
    "VoteID" SERIAL NOT NULL,
    "votingSessionId" INTEGER NOT NULL,
    "mealProposalId" INTEGER NOT NULL,
    "voterId" UUID NOT NULL,
    "voteType" "public"."VoteType" NOT NULL DEFAULT 'up',
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vote_pkey" PRIMARY KEY ("VoteID")
);

-- CreateIndex
CREATE UNIQUE INDEX "mealproposal_votingSessionId_mealId_key" ON "public"."mealproposal"("votingSessionId", "mealId");

-- CreateIndex
CREATE UNIQUE INDEX "vote_mealProposalId_voterId_key" ON "public"."vote"("mealProposalId", "voterId");

-- AddForeignKey
ALTER TABLE "public"."votingsession" ADD CONSTRAINT "votingsession_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."group"("GroupID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."votingsession" ADD CONSTRAINT "votingsession_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."votingsession" ADD CONSTRAINT "votingsession_winnerMealId_fkey" FOREIGN KEY ("winnerMealId") REFERENCES "public"."meal"("MealID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealproposal" ADD CONSTRAINT "mealproposal_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealproposal" ADD CONSTRAINT "mealproposal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."meal"("MealID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealproposal" ADD CONSTRAINT "mealproposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vote" ADD CONSTRAINT "vote_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vote" ADD CONSTRAINT "vote_mealProposalId_fkey" FOREIGN KEY ("mealProposalId") REFERENCES "public"."mealproposal"("MealProposalID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vote" ADD CONSTRAINT "vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
