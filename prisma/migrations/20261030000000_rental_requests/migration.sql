-- Level 2: 대여 신청 테이블 추가. 기존 items / rentals / sanitizations 는 바꾸지 않습니다.

-- CreateEnum
CREATE TYPE "RentalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "rental_requests" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "guardian_name" VARCHAR(20) NOT NULL,
    "guardian_phone" VARCHAR(13) NOT NULL,
    "child_age_months" INTEGER NOT NULL,
    "duration_days" INTEGER NOT NULL,
    "status" "RentalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approved_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "rental_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_requests_pkey" PRIMARY KEY ("id"),
    -- 희망 기간은 1~30일
    CONSTRAINT "rental_requests_duration_days_check" CHECK ("duration_days" BETWEEN 1 AND 30),
    -- 대여 처리됨이면 대여 기록과 처리 시각이 있어야 하고, 취소됨이면 취소 시각이 있어야 함
    CONSTRAINT "rental_requests_approved_check" CHECK ("status" <> 'APPROVED' OR ("rental_id" IS NOT NULL AND "approved_at" IS NOT NULL)),
    CONSTRAINT "rental_requests_cancelled_check" CHECK ("status" <> 'CANCELLED' OR "cancelled_at" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "rental_requests_rental_id_key" ON "rental_requests"("rental_id");

-- CreateIndex
CREATE INDEX "rental_requests_item_id_idx" ON "rental_requests"("item_id");

-- 용품당 신청 중(PENDING)인 건은 1건만 (코드 검사가 놓쳐도 DB가 막는 안전장치)
CREATE UNIQUE INDEX "rental_requests_one_pending_per_item" ON "rental_requests"("item_id") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_requests" ADD CONSTRAINT "rental_requests_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
