-- CreateEnum
CREATE TYPE "public"."BadgeType" AS ENUM ('group_creation', 'voting_participation', 'voting_winner', 'meal_creation', 'consumption_tracking', 'social_engagement');

-- CreateTable
CREATE TABLE "public"."badge" (
    "BadgeID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "badgeType" "public"."BadgeType" NOT NULL,
    "iconUrl" TEXT,
    "requirements" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("BadgeID")
);

-- CreateTable
CREATE TABLE "public"."userbadge" (
    "UserBadgeID" SERIAL NOT NULL,
    "profileId" UUID NOT NULL,
    "badgeId" INTEGER NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "maxProgress" INTEGER NOT NULL DEFAULT 1,
    "isCompleted" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "userbadge_pkey" PRIMARY KEY ("UserBadgeID")
);

-- CreateIndex
CREATE UNIQUE INDEX "badge_name_key" ON "public"."badge"("name");

-- CreateIndex
CREATE UNIQUE INDEX "userbadge_profileId_badgeId_key" ON "public"."userbadge"("profileId", "badgeId");

-- AddForeignKey
ALTER TABLE "public"."userbadge" ADD CONSTRAINT "userbadge_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."userbadge" ADD CONSTRAINT "userbadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "public"."badge"("BadgeID") ON DELETE CASCADE ON UPDATE CASCADE;
