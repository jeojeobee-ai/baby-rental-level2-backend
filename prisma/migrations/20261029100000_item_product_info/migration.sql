-- 물품 제품 정보 추가: 모두 빈 값을 허용하는 칸이라 기존 행은 그대로 남습니다.
ALTER TABLE "items"
  ADD COLUMN "brand" VARCHAR(30),
  ADD COLUMN "model_name" VARCHAR(40),
  ADD COLUMN "purchased_at" DATE,
  ADD COLUMN "image_url" VARCHAR(100);

-- 기존 가상 물품에 데모 사진·가상 브랜드·모델명·구매일을 채웁니다.
-- 관리 번호가 같고 아직 값이 비어 있는 행만 바꾸며, 다른 행과 대여·소독 기록은 건드리지 않습니다.
UPDATE "items" AS i
SET "brand" = v.brand, "model_name" = v.model_name, "purchased_at" = v.purchased_at::date, "image_url" = v.image_url
FROM (VALUES
  ('MOV-001', '햇빛베이비', '산책 S2 (HB-S210)', '2025-03-12', '/items/stroller.svg'),
  ('MOV-002', '구름나래', '클라우드 디럭스 (CN-D500)', '2024-11-05', '/items/stroller.svg'),
  ('MOV-003', '토닥랩', '포근 0+ (TD-C010)', '2025-06-20', '/items/car-seat.svg'),
  ('MOV-004', '토닥랩', '든든 주니어 (TD-C300)', '2024-09-02', '/items/car-seat.svg'),
  ('MOV-005', '솔방울키즈', '안아줘 캐리어 (SB-K100)', '2025-08-18', '/items/carrier.svg'),
  ('MOV-006', '솔방울키즈', '힙업 시트 (SB-H200)', '2024-05-27', '/items/carrier.svg'),
  ('SLP-001', '햇빛베이비', '나무숲 원목침대 (HB-B300)', '2024-10-14', '/items/crib.svg'),
  ('SLP-002', '구름나래', '폴딩 미니베드 (CN-B120)', '2025-02-03', '/items/crib.svg'),
  ('SLP-003', '구름나래', '말랑 범퍼베드 (CN-M200)', '2025-04-09', '/items/mattress.svg'),
  ('SLP-004', '토닥랩', '살랑 흔들침대 (TD-R050)', '2024-12-16', '/items/crib.svg'),
  ('SLP-005', '햇빛베이비', '나들이 바시넷 (HB-B110)', '2025-07-07', '/items/crib.svg'),
  ('SLP-006', '솔방울키즈', '꿀잠 매트 (SB-M090)', '2026-09-30', '/items/mattress.svg'),
  ('FED-001', '햇빛베이비', '반짝 UV 소독기 (HB-U400)', '2025-01-22', '/items/sterilizer.svg'),
  ('FED-002', '솔방울키즈', '퐁당 욕조 (SB-T150)', '2024-08-11', '/items/bath.svg'),
  ('FED-003', '구름나래', '폴딩 욕조 (CN-T220)', '2025-05-30', '/items/bath.svg'),
  ('FED-004', '토닥랩', '따끈 분유포트 (TD-K070)', '2025-09-08', '/items/kettle.svg'),
  ('FED-005', '햇빛베이비', '냠냠 쿠커 (HB-F160)', '2025-10-21', '/items/food-maker.svg'),
  ('FED-006', '구름나래', '맘마 하이체어 (CN-H300)', '2024-06-25', '/items/high-chair.svg'),
  ('PLY-001', '솔방울키즈', '아장 보행기 (SB-W060)', '2025-03-28', '/items/walker.svg'),
  ('PLY-002', '토닥랩', '둥실 바운서 (TD-B080)', '2024-11-19', '/items/bouncer.svg'),
  ('PLY-003', '구름나래', '콩콩 점퍼 (CN-J140)', '2025-02-14', '/items/activity-center.svg'),
  ('PLY-004', '햇빛베이비', '반짝 플레이짐 (HB-P050)', '2024-07-30', '/items/play-gym.svg'),
  ('PLY-005', '솔방울키즈', '빙글 쏘서 (SB-S070)', '2025-06-05', '/items/activity-center.svg'),
  ('PLY-006', '토닥랩', '놀이집 러닝홈 (TD-L200)', '2024-12-02', '/items/play-house.svg')
) AS v(code, brand, model_name, purchased_at, image_url)
WHERE i."code" = v.code
  AND i."brand" IS NULL AND i."model_name" IS NULL AND i."purchased_at" IS NULL AND i."image_url" IS NULL;
