-- CreateTable
CREATE TABLE "public"."userproposalconfirmation" (
    "UserProposalConfirmationID" SERIAL NOT NULL,
    "votingSessionId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "userproposalconfirmation_pkey" PRIMARY KEY ("UserProposalConfirmationID")
);

-- CreateTable
CREATE TABLE "public"."uservoteconfirmation" (
    "UserVoteConfirmationID" SERIAL NOT NULL,
    "votingSessionId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uservoteconfirmation_pkey" PRIMARY KEY ("UserVoteConfirmationID")
);

-- CreateIndex
CREATE UNIQUE INDEX "userproposalconfirmation_votingSessionId_userId_key" ON "public"."userproposalconfirmation"("votingSessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "uservoteconfirmation_votingSessionId_userId_key" ON "public"."uservoteconfirmation"("votingSessionId", "userId");

-- AddForeignKey
ALTER TABLE "public"."userproposalconfirmation" ADD CONSTRAINT "userproposalconfirmation_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."userproposalconfirmation" ADD CONSTRAINT "userproposalconfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."uservoteconfirmation" ADD CONSTRAINT "uservoteconfirmation_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."uservoteconfirmation" ADD CONSTRAINT "uservoteconfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
