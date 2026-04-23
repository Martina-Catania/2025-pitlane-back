-- CreateEnum
CREATE TYPE "public"."InvitationStatus" AS ENUM ('pending', 'accepted', 'rejected', 'expired');

-- CreateTable
CREATE TABLE "public"."groupinvitation" (
    "InvitationID" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "invitedById" UUID NOT NULL,
    "invitedUserId" UUID NOT NULL,
    "status" "public"."InvitationStatus" NOT NULL DEFAULT 'pending',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "groupinvitation_pkey" PRIMARY KEY ("InvitationID")
);

-- CreateIndex
CREATE UNIQUE INDEX "groupinvitation_groupId_invitedUserId_key" ON "public"."groupinvitation"("groupId", "invitedUserId");

-- AddForeignKey
ALTER TABLE "public"."groupinvitation" ADD CONSTRAINT "groupinvitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."group"("GroupID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupinvitation" ADD CONSTRAINT "groupinvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."groupinvitation" ADD CONSTRAINT "groupinvitation_invitedUserId_fkey" FOREIGN KEY ("invitedUserId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
