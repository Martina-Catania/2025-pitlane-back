-- CreateTable
CREATE TABLE "public"."meal" (
    "MealID" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "profileId" UUID NOT NULL,

    CONSTRAINT "meal_pkey" PRIMARY KEY ("MealID")
);

-- CreateTable
CREATE TABLE "public"."_meal_food" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_meal_food_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_meal_food_B_index" ON "public"."_meal_food"("B");

-- AddForeignKey
ALTER TABLE "public"."meal" ADD CONSTRAINT "meal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "public"."profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_meal_food" ADD CONSTRAINT "_meal_food_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."food"("FoodID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_meal_food" ADD CONSTRAINT "_meal_food_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."meal"("MealID") ON DELETE CASCADE ON UPDATE CASCADE;
