import { Controller, ForbiddenException, Headers, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { seedDemoData } from '../seed';

// 초기화는 이 이름의 DB에서만 실행합니다. (Level 1 DB 이름은 babyrental 이라 절대 실행되지 않음)
export const DEMO_DB_NAME = 'baby_rental_level2';

const DISABLED = '초기화 기능이 꺼져 있어요.';
const WRONG_DB = '이 데이터베이스에서는 초기화할 수 없어요.';
const WRONG_TOKEN = '초기화 토큰이 맞지 않아요.';

// 문자열 길이나 비교 시간 차이로 값이 새지 않도록 해시끼리 고정 시간으로 비교합니다.
function sameSecret(given: string, expected: string): boolean {
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

@Controller('admin')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  // B13. 가상 데이터 다시 채우기
  //  ① ALLOW_DEMO_RESET=true 인 서버에서만, ② DEMO_RESET_TOKEN 이 설정되어 있고 요청 헤더 x-reset-token 이 같을 때만,
  //  ③ 접속한 DB 이름이 DEMO_DB_NAME 일 때만 동작하며, ④ 삭제와 다시 채우기는 한 트랜잭션입니다.
  @Post('reset-demo')
  @HttpCode(200)
  async resetDemo(@Headers('x-reset-token') givenToken?: string) {
    const expectedToken = process.env.DEMO_RESET_TOKEN ?? '';
    if (process.env.ALLOW_DEMO_RESET !== 'true' || expectedToken === '') {
      throw new ForbiddenException({ message: DISABLED });
    }
    if (typeof givenToken !== 'string' || givenToken === '' || !sameSecret(givenToken, expectedToken)) {
      await new Promise((resolve) => setTimeout(resolve, 500)); // 토큰을 계속 바꿔 가며 시도하는 것을 늦춤
      throw new UnauthorizedException({ errors: { token: WRONG_TOKEN } });
    }
    const [{ db }] = await this.prisma.$queryRaw<{ db: string }[]>`SELECT current_database() AS db`;
    if (db !== DEMO_DB_NAME) throw new ForbiddenException({ message: WRONG_DB });

    const result = await seedDemoData(this.prisma, { reset: true });
    return { ok: true, ...result };
  }
}
