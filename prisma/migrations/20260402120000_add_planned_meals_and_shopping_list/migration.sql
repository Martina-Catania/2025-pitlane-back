-- CreateEnum
CREATE TYPE "PlannedMealStatus" AS ENUM ('scheduled', 'awaiting_confirmation', 'consumed', 'rescheduled', 'cancelled');

-- CreateTable
CREATE TABLE "plannedmeal" (
    "PlannedMealID" SERIAL NOT NULL,
    "profileId" UUID NOT NULL,
    "groupId" INTEGER,
    "mealId" INTEGER NOT NULL,
    "consumptionId" INTEGER,
    "plannedFor" TIMESTAMP(3) NOT NULL,
    "status" "PlannedMealStatus" NOT NULL DEFAULT 'scheduled',
    "estimatedKcal" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "resolvedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "plannedmeal_pkey" PRIMARY KEY ("PlannedMealID")
);

-- CreateTable
CREATE TABLE "plannedmealfood" (
    "PlannedMealFoodID" SERIAL NOT NULL,
    "plannedMealId" INTEGER NOT NULL,
    "foodId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isPurchased" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3),
    "purchasedById" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plannedmealfood_pkey" PRIMARY KEY ("PlannedMealFoodID")
);

-- CreateTable
CREATE TABLE "plannedmealconfirmation" (
    "PlannedMealConfirmationID" SERIAL NOT NULL,
    "plannedMealId" INTEGER NOT NULL,
    "userId" UUID NOT NULL,
    "wasConsumed" BOOLEAN NOT NULL,
    "action" "PlannedMealStatus" NOT NULL,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "plannedmealconfirmation_pkey" PRIMARY KEY ("PlannedMealConfirmationID")
);

-- CreateIndex
CREATE INDEX "plannedmeal_profileId_plannedFor_status_idx" ON "plannedmeal"("profileId", "plannedFor", "status");

-- CreateIndex
CREATE INDEX "plannedmeal_groupId_plannedFor_status_idx" ON "plannedmeal"("groupId", "plannedFor", "status");

-- CreateIndex
CREATE INDEX "plannedmeal_plannedFor_status_idx" ON "plannedmeal"("plannedFor", "status");

-- CreateIndex
CREATE UNIQUE INDEX "plannedmealfood_plannedMealId_foodId_key" ON "plannedmealfood"("plannedMealId", "foodId");

-- CreateIndex
CREATE INDEX "plannedmealfood_foodId_isActive_isPurchased_idx" ON "plannedmealfood"("foodId", "isActive", "isPurchased");

-- CreateIndex
CREATE INDEX "plannedmealconfirmation_plannedMealId_confirmedAt_idx" ON "plannedmealconfirmation"("plannedMealId", "confirmedAt");

-- AddForeignKey
ALTER TABLE "plannedmeal" ADD CONSTRAINT "plannedmeal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmeal" ADD CONSTRAINT "plannedmeal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "group"("GroupID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmeal" ADD CONSTRAINT "plannedmeal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "meal"("MealID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmeal" ADD CONSTRAINT "plannedmeal_consumptionId_fkey" FOREIGN KEY ("consumptionId") REFERENCES "mealconsumption"("MealConsumptionID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmeal" ADD CONSTRAINT "plannedmeal_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmealfood" ADD CONSTRAINT "plannedmealfood_plannedMealId_fkey" FOREIGN KEY ("plannedMealId") REFERENCES "plannedmeal"("PlannedMealID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmealfood" ADD CONSTRAINT "plannedmealfood_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "food"("FoodID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmealfood" ADD CONSTRAINT "plannedmealfood_purchasedById_fkey" FOREIGN KEY ("purchasedById") REFERENCES "profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmealconfirmation" ADD CONSTRAINT "plannedmealconfirmation_plannedMealId_fkey" FOREIGN KEY ("plannedMealId") REFERENCES "plannedmeal"("PlannedMealID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plannedmealconfirmation" ADD CONSTRAINT "plannedmealconfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
