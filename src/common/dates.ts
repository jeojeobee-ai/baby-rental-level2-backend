// 날짜는 화면과 API 모두 'YYYY-MM-DD' 글자로 주고받습니다.
// DB의 DATE 칸은 UTC 자정으로 저장해 시간대 때문에 하루가 밀리지 않게 합니다.

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

// 센터가 한국에 있으므로 "오늘"은 한국 시간 기준입니다.
export function todayInKorea(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function toDbDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function fromDbDate(value: Date): string;
export function fromDbDate(value: Date | null): string | null;
export function fromDbDate(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function addDays(value: string, days: number): string {
  const date = toDbDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return fromDbDate(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toDbDate(to).getTime() - toDbDate(from).getTime()) / 86_400_000);
}
