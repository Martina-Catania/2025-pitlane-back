-- AlterTable
ALTER TABLE "public"."profile" ADD COLUMN     "primaryBadgeId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."profile" ADD CONSTRAINT "profile_primaryBadgeId_fkey" FOREIGN KEY ("primaryBadgeId") REFERENCES "public"."badge"("BadgeID") ON DELETE SET NULL ON UPDATE CASCADE;
