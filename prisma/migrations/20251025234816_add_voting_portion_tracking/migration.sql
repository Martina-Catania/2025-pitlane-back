-- CreateTable
CREATE TABLE "public"."votingsessionparticipant" (
    "ParticipantID" SERIAL NOT NULL,
    "votingSessionId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "portionDeadline" TIMESTAMP(3) NOT NULL,
    "hasSelectedPortion" BOOLEAN NOT NULL DEFAULT false,
    "selectedAt" TIMESTAMP(3),
    "defaultedToWhole" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "votingsessionparticipant_pkey" PRIMARY KEY ("ParticipantID")
);

-- CreateTable
CREATE TABLE "public"."mealportion" (
    "MealPortionID" SERIAL NOT NULL,
    "participantId" INTEGER NOT NULL,
    "mealId" INTEGER NOT NULL,
    "portionFraction" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mealportion_pkey" PRIMARY KEY ("MealPortionID")
);

-- CreateTable
CREATE TABLE "public"."foodportion" (
    "FoodPortionID" SERIAL NOT NULL,
    "mealPortionId" INTEGER NOT NULL,
    "foodId" INTEGER NOT NULL,
    "portionFraction" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "quantityConsumed" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "foodportion_pkey" PRIMARY KEY ("FoodPortionID")
);

-- CreateIndex
CREATE UNIQUE INDEX "votingsessionparticipant_votingSessionId_userId_key" ON "public"."votingsessionparticipant"("votingSessionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "mealportion_participantId_mealId_key" ON "public"."mealportion"("participantId", "mealId");

-- CreateIndex
CREATE UNIQUE INDEX "foodportion_mealPortionId_foodId_key" ON "public"."foodportion"("mealPortionId", "foodId");

-- AddForeignKey
ALTER TABLE "public"."votingsessionparticipant" ADD CONSTRAINT "votingsessionparticipant_votingSessionId_fkey" FOREIGN KEY ("votingSessionId") REFERENCES "public"."votingsession"("VotingSessionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."votingsessionparticipant" ADD CONSTRAINT "votingsessionparticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealportion" ADD CONSTRAINT "mealportion_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."votingsessionparticipant"("ParticipantID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."mealportion" ADD CONSTRAINT "mealportion_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "public"."meal"("MealID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."foodportion" ADD CONSTRAINT "foodportion_mealPortionId_fkey" FOREIGN KEY ("mealPortionId") REFERENCES "public"."mealportion"("MealPortionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."foodportion" ADD CONSTRAINT "foodportion_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "public"."food"("FoodID") ON DELETE CASCADE ON UPDATE CASCADE;
