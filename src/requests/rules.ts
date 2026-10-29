// Level 2 업무 규칙 R1~R6 중 "이 용품을 지금 신청·대여할 수 있는가"를 판단하는 곳입니다.
// 대여 기록 등록(B5), 신청 등록(B8), 대여 처리(B11)가 모두 이 함수를 써서 같은 결과를 냅니다.
import { ItemStatus, computeItemStatus } from '../items/item-status';

export type RuleMode = 'direct' | 'request' | 'approve';

// R1: 지금 상태가 "대여 가능"이 아니면 신청·대여할 수 없습니다.
export const STATUS_MESSAGES: Record<Exclude<ItemStatus, 'AVAILABLE'>, string> = {
  RENTED: '이미 대여 중인 용품이에요. 반납 처리를 한 뒤 진행해 주세요.',
  AWAITING_SANITIZATION: '반납 뒤 소독 기록이 없는 용품이에요. 소독 기록을 먼저 남겨 주세요.',
  NEEDS_RESANITIZATION: '마지막 소독이 완료되지 않은 용품이에요. 다시 소독한 뒤 진행해 주세요.',
  NEEDS_REPAIR: '수리가 필요한 용품이라 빌려줄 수 없어요.',
};

// R3: 용품당 신청 중인 건은 1건
export const REQUEST_EXISTS = '이미 신청 중인 용품이에요. 먼저 신청한 건을 대여 처리하거나 취소해 주세요.';
// R6: 신청 중인 건이 있는 용품은 직접 대여 기록을 등록할 수 없음
export const PENDING_BLOCKS_DIRECT =
  '신청 중인 건이 있는 용품이에요. 신청 목록에서 대여 처리하거나 신청을 취소해 주세요.';

interface RuleItem {
  condition: string;
  rentals: { rentedAt: Date; returnedAt: Date | null; createdAt: Date }[];
  sanitizations: { sanitizedAt: Date; result: 'PASS' | 'FAIL'; createdAt: Date }[];
}

// 막아야 하면 안내 문구를, 괜찮으면 null을 돌려줍니다.
// 순서: 신청 중인 건(R6 / R3) → 지금 상태(R1, 대여 처리 때는 R5)
export function itemBlockMessage(item: RuleItem, pendingCount: number, mode: RuleMode): string | null {
  if (mode === 'direct' && pendingCount > 0) return PENDING_BLOCKS_DIRECT;
  if (mode === 'request' && pendingCount > 0) return REQUEST_EXISTS;
  const status = computeItemStatus(item.condition, item.rentals, item.sanitizations);
  return status === 'AVAILABLE' ? null : STATUS_MESSAGES[status];
}

// R2: 아기 월령이 용품의 사용 월령 범위 안이어야 합니다 (양 끝 포함).
export function ageRangeMessage(item: { minAgeMonths: number; maxAgeMonths: number }, childAgeMonths: number): string | null {
  return childAgeMonths >= item.minAgeMonths && childAgeMonths <= item.maxAgeMonths
    ? null
    : `이 용품은 ${item.minAgeMonths}~${item.maxAgeMonths}개월 아기용이에요. 아기 월령을 확인해 주세요.`;
}
