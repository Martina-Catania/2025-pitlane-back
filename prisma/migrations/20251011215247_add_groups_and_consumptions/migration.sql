-- CreateEnum
CREATE TYPE "public"."GroupRole" AS ENUM ('admin', 'member');

-- CreateEnum
CREATE TYPE "public"."ConsumptionType" AS ENUM ('individual', 'group');

-- CreateTable
CREATE TABLE "public"."group" (
    "GroupID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "group_pkey" PRIMARY KEY ("GroupID")
);

-- CreateTable
CREATE TABLE "public"."groupmember" (
    "GroupMemberID" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "profileId" UUID NOT NULL,
    "role" "public"."GroupRole" NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "groupmember_pkey" PRIMARY KEY ("GroupMemberID")
);

-- CreateTable
CREATE TABLE "public"."consumption" (
    "ConsumptionID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."ConsumptionType" NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "profileId" UUID NOT NULL,
    "groupId" INTEGER,
    "totalKcal" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "consumption_pkey" PRIMARY KEY ("ConsumptionID")
);

-- CreateTable
CREATE TABLE "public"."consumptionfood" (
    "ConsumptionFoodID" SERIAL NOT NULL,
    "consumptionId" INTEGER NOT NULL,
    "foodId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "consumptionfood_pkey" PRIMARY KEY ("ConsumptionFoodID")
);

-- CreateIndex
CREATE UNIQUE INDEX "groupmember_groupId_profileId_key" ON "public"."groupmember"("groupId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "consumptionfood_consumptionId_foodId_key" ON "public"."consumptionfood"("consumptionId", "foodId");

-- AddForeignKey
ALTER TABLE "public"."group" ADD CONSTRAINT "group_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupmember" ADD CONSTRAINT "groupmember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."group"("GroupID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupmember" ADD CONSTRAINT "groupmember_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumption" ADD CONSTRAINT "consumption_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumption" ADD CONSTRAINT "consumption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."group"("GroupID") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumptionfood" ADD CONSTRAINT "consumptionfood_consumptionId_fkey" FOREIGN KEY ("consumptionId") REFERENCES "public"."consumption"("ConsumptionID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."consumptionfood" ADD CONSTRAINT "consumptionfood_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "public"."food"("FoodID") ON DELETE CASCADE ON UPDATE CASCADE;
