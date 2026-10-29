import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { addDays, todayInKorea, toDbDate } from '../common/dates';
import { FORM_ERROR, FieldErrors, asBody, intInRange, oneOf, text } from '../common/validation';
import { ItemsService, serializeRental } from '../items/items.service';
import { PrismaService } from '../prisma/prisma.service';
import { REQUEST_EXISTS, ageRangeMessage, itemBlockMessage } from './rules';
import { serializeRequest } from './serialize';

export const REQUEST_NOT_FOUND = '찾는 신청이 없어요';
const ALREADY_CANCELLED = '이미 취소된 신청이에요.';
const ALREADY_APPROVED = '이미 대여 처리된 신청이에요.';
const APPROVED_CANNOT_CANCEL =
  '이미 대여 처리된 신청이에요. 대여 처리된 신청은 취소할 수 없어요. 반납은 용품 상세에서 처리해 주세요.';

const PHONE_PATTERN = /^010-\d{4}-\d{4}$/;
const STATUSES = ['PENDING', 'APPROVED', 'CANCELLED'] as const;

function throwForm(message: string): never {
  const errors = new FieldErrors();
  errors.add(FORM_ERROR, message);
  errors.throwIfAny();
  throw new Error('unreachable');
}

@Injectable()
export class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly items: ItemsService,
  ) {}

  // B8. 대여 신청 등록 (R1·R2·R3)
  async create(itemId: number, rawBody: unknown) {
    const item = await this.items.getWithRentalsOr404(itemId);
    const body = asBody(rawBody);
    const errors = new FieldErrors();

    const pendingCount = await this.prisma.rentalRequest.count({ where: { itemId, status: 'PENDING' } });
    const blocked = itemBlockMessage(item, pendingCount, 'request');
    if (blocked) errors.add(FORM_ERROR, blocked);

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
    } else {
      const ageMessage = ageRangeMessage(item, childAgeMonths);
      if (ageMessage) errors.add('childAgeMonths', ageMessage);
    }

    const durationDays = intInRange(body.durationDays, 1, 30);
    if (durationDays === null) {
      errors.add('durationDays', '희망 대여 기간은 1일부터 30일 사이 숫자로 적어 주세요.');
    }
    errors.throwIfAny();

    // 동시에 들어온 신청도 한 건만 저장되도록 용품 줄을 잠근 뒤 다시 확인합니다.
    try {
      const request = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM items WHERE id = ${itemId} FOR UPDATE`;
        const fresh = await tx.item.findUniqueOrThrow({
          where: { id: itemId },
          include: { rentals: true, sanitizations: true },
        });
        const pending = await tx.rentalRequest.count({ where: { itemId, status: 'PENDING' } });
        const again = itemBlockMessage(fresh, pending, 'request');
        if (again) throwForm(again);
        return tx.rentalRequest.create({
          data: { itemId, guardianName, guardianPhone, childAgeMonths: childAgeMonths!, durationDays: durationDays! },
        });
      });
      return serializeRequest(request);
    } catch (error) {
      // 마지막 안전장치: DB의 "신청 중 1건" 고유 인덱스
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throwForm(REQUEST_EXISTS);
      throw error;
    }
  }

  // B9. 신청 목록 (최신순, 상태로 거르기)
  async findAll(rawStatus: unknown) {
    let status: (typeof STATUSES)[number] | undefined;
    if (rawStatus !== undefined && rawStatus !== '') {
      const parsed = oneOf(rawStatus, STATUSES);
      if (!parsed) {
        const errors = new FieldErrors();
        errors.add('status', '신청 상태는 PENDING, APPROVED, CANCELLED 중 하나로 보내 주세요.');
        errors.throwIfAny();
      }
      status = parsed!;
    }
    const requests = await this.prisma.rentalRequest.findMany({
      where: status ? { status } : {},
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: { item: { select: { id: true, code: true, name: true } } },
    });
    return requests.map((request) => serializeRequest(request, request.item));
  }

  // B10. 신청 취소 (R4)
  async cancel(requestId: number) {
    const existing = await this.prisma.rentalRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new NotFoundException({ message: REQUEST_NOT_FOUND });

    // 신청 중일 때만 바꿉니다. 대여 처리와 동시에 들어와도 먼저 끝난 쪽만 성공합니다.
    const { count } = await this.prisma.rentalRequest.updateMany({
      where: { id: requestId, status: 'PENDING' },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    });
    const current = await this.prisma.rentalRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (count === 0) {
      throwForm(current.status === 'APPROVED' ? APPROVED_CANNOT_CANCEL : ALREADY_CANCELLED);
    }
    return serializeRequest(current);
  }

  // B11. 대여 처리: 대여 기록 1건을 만들고 신청을 APPROVED로 바꿉니다 (R4·R5·R1)
  async approve(requestId: number) {
    const existing = await this.prisma.rentalRequest.findUnique({ where: { id: requestId } });
    if (!existing) throw new NotFoundException({ message: REQUEST_NOT_FOUND });
    if (existing.status !== 'PENDING') {
      throwForm(existing.status === 'APPROVED' ? ALREADY_APPROVED : ALREADY_CANCELLED);
    }

    const rental = await this.prisma.$transaction(async (tx) => {
      // 잠그는 순서: 용품 줄 → 신청 줄. (취소는 신청 줄만 잠그므로 서로 기다리다 멈추는 일이 없음)
      await tx.$queryRaw`SELECT id FROM items WHERE id = ${existing.itemId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM rental_requests WHERE id = ${requestId} FOR UPDATE`;

      const request = await tx.rentalRequest.findUniqueOrThrow({ where: { id: requestId } });
      if (request.status !== 'PENDING') {
        throwForm(request.status === 'APPROVED' ? ALREADY_APPROVED : ALREADY_CANCELLED);
      }

      // R5: 신청한 뒤 용품 상태가 바뀌었을 수 있으므로 지금 다시 검사
      const item = await tx.item.findUniqueOrThrow({
        where: { id: request.itemId },
        include: { rentals: true, sanitizations: true },
      });
      const blocked = itemBlockMessage(item, 0, 'approve');
      if (blocked) throwForm(blocked);

      // 빌린 날 = 대여 처리하는 날, 반납 예정일 = 빌린 날 + 희망 기간 (시작일은 기간에 세지 않음)
      const today = todayInKorea();
      const created = await tx.rental.create({
        data: {
          itemId: request.itemId,
          guardianName: request.guardianName,
          guardianPhone: request.guardianPhone,
          childAgeMonths: request.childAgeMonths,
          rentedAt: toDbDate(today),
          dueDate: toDbDate(addDays(today, request.durationDays)),
        },
      });
      const { count } = await tx.rentalRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { status: 'APPROVED', approvedAt: new Date(), rentalId: created.id },
      });
      if (count !== 1) throw new Error('신청 상태를 바꾸지 못했어요'); // 전체 되돌림
      return created;
    });
    return serializeRental(rental);
  }
}
