import { Injectable, NotFoundException } from '@nestjs/common';
import { daysBetween, isValidDate, toDbDate, todayInKorea } from '../common/dates';
import { FORM_ERROR, FieldErrors, asBody, intInRange, text } from '../common/validation';
import { ItemsService, serializeRental } from '../items/items.service';
import { PrismaService } from '../prisma/prisma.service';

export const RENTAL_NOT_FOUND = '찾는 대여 기록이 없어요';
const ALREADY_RENTED = '이미 대여 중인 용품이에요. 반납 처리를 한 뒤 대여 기록을 남겨 주세요.';

const PHONE_PATTERN = /^010-\d{4}-\d{4}$/;
const MAX_RENTAL_DAYS = 30;

@Injectable()
export class RentalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
  ) {}

  // B5. 대여 기록 등록
  async create(itemId: number, rawBody: unknown) {
    const item = await this.items.getWithRentalsOr404(itemId);

    const body = asBody(rawBody);
    const errors = new FieldErrors();
    const today = todayInKorea();

    // 반납 안 된 대여가 남아 있으면 같은 용품을 또 빌려줄 수 없습니다.
    if (item.rentals.some((rental) => rental.returnedAt === null)) {
      errors.add(FORM_ERROR, ALREADY_RENTED);
    }

    const guardianName = text(body.guardianName);
    if (guardianName.length < 2 || guardianName.length > 20) {
      errors.add('guardianName', '보호자 이름을 2~20자로 적어 주세요.');
    }

    const guardianPhone = text(body.guardianPhone);
    if (!PHONE_PATTERN.test(guardianPhone)) {
      errors.add('guardianPhone', '연락처는 010-1234-5678처럼 적어 주세요.');
    }

    const childAgeMonths = intInRange(body.childAgeMonths, 0, 72);
    if (childAgeMonths === null) {
      errors.add('childAgeMonths', '아기 월령은 0부터 72 사이 숫자로 적어 주세요.');
    }

    const rentedAt = body.rentedAt;
    if (!isValidDate(rentedAt) || rentedAt > today) {
      errors.add('rentedAt', '빌린 날은 오늘이나 그 이전 날짜로 골라 주세요.');
    }

    const dueDate = body.dueDate;
    if (!isValidDate(dueDate)) {
      errors.add('dueDate', '반납 예정일은 빌린 날 이후로 골라 주세요.');
    } else if (isValidDate(rentedAt)) {
      if (dueDate < rentedAt) {
        errors.add('dueDate', '반납 예정일은 빌린 날 이후로 골라 주세요.');
      } else if (daysBetween(rentedAt, dueDate) > MAX_RENTAL_DAYS) {
        errors.add('dueDate', '대여 기간은 최대 30일이에요. 반납 예정일을 다시 골라 주세요.');
      }
    }
    errors.throwIfAny();

    // 저장 버튼을 두 번 누르는 등 동시에 들어온 요청도 한 건만 저장되도록 용품 줄을 잠근 뒤 다시 확인합니다.
    const rental = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM items WHERE id = ${itemId} FOR UPDATE`;
      const active = await tx.rental.count({ where: { itemId, returnedAt: null } });
      if (active > 0) {
        const conflict = new FieldErrors();
        conflict.add(FORM_ERROR, ALREADY_RENTED);
        conflict.throwIfAny();
      }
      return tx.rental.create({
        data: {
          itemId,
          guardianName,
          guardianPhone,
          childAgeMonths: childAgeMonths!,
          rentedAt: toDbDate(rentedAt as string),
          dueDate: toDbDate(dueDate as string),
        },
      });
    });
    return serializeRental(rental);
  }

  // B6. 반납 처리
  async markReturned(rentalId: number, rawBody: unknown) {
    const rental = await this.prisma.rental.findUnique({ where: { id: rentalId } });
    if (!rental) throw new NotFoundException({ message: RENTAL_NOT_FOUND });

    const errors = new FieldErrors();
    if (rental.returnedAt) {
      errors.add(FORM_ERROR, '이미 반납 처리된 기록이에요.');
      errors.throwIfAny();
    }

    const returnedAt = asBody(rawBody).returnedAt;
    const rentedAt = rental.rentedAt.toISOString().slice(0, 10);
    if (!isValidDate(returnedAt) || returnedAt < rentedAt || returnedAt > todayInKorea()) {
      errors.add('returnedAt', '반납일은 빌린 날부터 오늘 사이로 골라 주세요.');
    }
    errors.throwIfAny();

    // 동시에 두 번 눌러도 한 번만 반납되도록 "아직 반납 안 된 기록"일 때만 바꿉니다.
    const { count } = await this.prisma.rental.updateMany({
      where: { id: rentalId, returnedAt: null },
      data: { returnedAt: toDbDate(returnedAt as string) },
    });
    if (count === 0) {
      errors.add(FORM_ERROR, '이미 반납 처리된 기록이에요.');
      errors.throwIfAny();
    }

    const updated = await this.prisma.rental.findUniqueOrThrow({ where: { id: rentalId } });
    return serializeRental(updated);
  }
}
