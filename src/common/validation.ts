import { BadRequestException, NotFoundException } from '@nestjs/common';

// 기획서 8장: 오류는 { errors: { 칸이름: 안내 문구 } } 형태로 돌려줍니다.
// 특정 칸이 아닌 안내는 '_form' 칸에 담습니다.
export const FORM_ERROR = '_form';

export class FieldErrors {
  private readonly errors: Record<string, string> = {};

  add(field: string, message: string) {
    // 한 칸에는 가장 먼저 발견한 안내 하나만 보여 줍니다.
    if (!this.errors[field]) this.errors[field] = message;
  }

  has(field: string) {
    return field in this.errors;
  }

  throwIfAny() {
    if (Object.keys(this.errors).length > 0) {
      throw new BadRequestException({ errors: this.errors });
    }
  }
}

export function asBody(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function optionalText(value: unknown): string | null {
  const trimmed = text(value);
  return trimmed === '' ? null : trimmed;
}

// 숫자 칸은 숫자 또는 숫자 글자("8")를 받고, 범위 밖이면 null을 돌려줍니다.
export function intInRange(value: unknown, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof number !== 'number' || !Number.isInteger(number)) return null;
  return number >= min && number <= max ? number : null;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

// 주소의 :id가 숫자가 아니면 없는 기록으로 봅니다.
export function parseId(value: string, notFoundMessage: string): number {
  const id = /^\d{1,9}$/.test(value) ? Number(value) : 0;
  if (id < 1) throw new NotFoundException({ message: notFoundMessage });
  return id;
}
