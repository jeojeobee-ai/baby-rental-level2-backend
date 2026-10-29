-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemCategory" AS ENUM ('MOBILITY', 'SLEEP', 'FEEDING', 'PLAY');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD', 'FAIR', 'NEEDS_REPAIR');

-- CreateEnum
CREATE TYPE "SanitizationMethod" AS ENUM ('STEAM', 'UV', 'WASH');

-- CreateEnum
CREATE TYPE "SanitizationResult" AS ENUM ('PASS', 'FAIL');

-- CreateTable
CREATE TABLE "items" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(7) NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "category" "ItemCategory" NOT NULL,
    "min_age_months" INTEGER NOT NULL,
    "max_age_months" INTEGER NOT NULL,
    "condition" "ItemCondition" NOT NULL,
    "memo" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "guardian_name" VARCHAR(20) NOT NULL,
    "guardian_phone" VARCHAR(13) NOT NULL,
    "child_age_months" INTEGER NOT NULL,
    "rented_at" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "returned_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sanitizations" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "sanitized_at" DATE NOT NULL,
    "staff_name" VARCHAR(20) NOT NULL,
    "method" "SanitizationMethod" NOT NULL,
    "result" "SanitizationResult" NOT NULL,
    "memo" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sanitizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "items_code_key" ON "items"("code");

-- CreateIndex
CREATE INDEX "rentals_item_id_idx" ON "rentals"("item_id");

-- CreateIndex
CREATE INDEX "sanitizations_item_id_idx" ON "sanitizations"("item_id");

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanitizations" ADD CONSTRAINT "sanitizations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

