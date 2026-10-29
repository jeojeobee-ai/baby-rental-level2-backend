// 기획서 6장 "지금 상태 계산 방법"을 그대로 옮긴 곳입니다.
// 목록(B2)과 상세(B3)가 모두 이 함수 하나만 써서 같은 결과를 냅니다.

export type ItemStatus =
  | 'AVAILABLE' // 대여 가능
  | 'RENTED' // 대여 중
  | 'AWAITING_SANITIZATION' // 소독 대기
  | 'NEEDS_RESANITIZATION' // 재소독 필요
  | 'NEEDS_REPAIR'; // 수리 필요

interface StatusRental {
  rentedAt: Date;
  returnedAt: Date | null;
  createdAt: Date;
}

interface StatusSanitization {
  sanitizedAt: Date;
  result: 'PASS' | 'FAIL';
  createdAt: Date;
}

// 날짜가 같으면 기록한 때(created_at)로 앞뒤를 정합니다.
function latest<T extends { createdAt: Date }>(records: T[], dateOf: (record: T) => Date): T | undefined {
  return records.reduce<T | undefined>((best, record) => {
    if (!best) return record;
    const diff = dateOf(record).getTime() - dateOf(best).getTime();
    if (diff !== 0) return diff > 0 ? record : best;
    return record.createdAt > best.createdAt ? record : best;
  }, undefined);
}

export function computeItemStatus(
  condition: string,
  rentals: StatusRental[],
  sanitizations: StatusSanitization[],
): ItemStatus {
  // 1. 반납 안 된 대여가 있으면 대여 중
  if (rentals.some((rental) => rental.returnedAt === null)) return 'RENTED';

  // 2. 용품 자체가 고장 나 있으면 수리 필요
  if (condition === 'NEEDS_REPAIR') return 'NEEDS_REPAIR';

  // 3. 소독 기록이 하나도 없으면 소독 대기
  const lastSanitization = latest(sanitizations, (record) => record.sanitizedAt);
  if (!lastSanitization) return 'AWAITING_SANITIZATION';

  // 4. 마지막 대여의 반납 뒤에 한 소독이 아니면 소독 대기
  const lastRental = latest(rentals, (record) => record.rentedAt);
  if (lastRental) {
    const returnedAt = lastRental.returnedAt as Date;
    const afterReturn =
      lastSanitization.sanitizedAt.getTime() >= returnedAt.getTime() &&
      lastSanitization.createdAt > lastRental.createdAt;
    if (!afterReturn) return 'AWAITING_SANITIZATION';
  }

  // 5. 마지막 소독이 소독 미완료면 재소독 필요
  if (lastSanitization.result === 'FAIL') return 'NEEDS_RESANITIZATION';

  // 6. 그 밖에는 대여 가능
  return 'AVAILABLE';
}
