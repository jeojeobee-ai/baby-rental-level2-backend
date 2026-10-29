import { RentalRequest } from '@prisma/client';
import { dateInKorea, daysBetween, todayInKorea } from '../common/dates';

// 신청 한 건을 화면에 돌려줄 모양으로 바꿉니다. 경과일 = 오늘(한국 시간) − 신청한 날 (오늘 신청이면 0)
export function serializeRequest(
  request: RentalRequest,
  item?: { id: number; code: string; name: string },
) {
  return {
    id: request.id,
    itemId: request.itemId,
    ...(item ? { item: { id: item.id, code: item.code, name: item.name } } : {}),
    guardianName: request.guardianName,
    guardianPhone: request.guardianPhone,
    childAgeMonths: request.childAgeMonths,
    durationDays: request.durationDays,
    status: request.status,
    approvedAt: request.approvedAt,
    cancelledAt: request.cancelledAt,
    rentalId: request.rentalId,
    createdAt: request.createdAt,
    elapsedDays: daysBetween(dateInKorea(request.createdAt), todayInKorea()),
  };
}
