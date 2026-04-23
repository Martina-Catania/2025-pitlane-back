/*
  Warnings:

  - You are about to drop the `_meal_food` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."_meal_food" DROP CONSTRAINT "_meal_food_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_meal_food" DROP CONSTRAINT "_meal_food_B_fkey";

-- DropTable
DROP TABLE "public"."_meal_food";
