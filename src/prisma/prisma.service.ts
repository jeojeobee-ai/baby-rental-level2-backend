import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// DB 연결 주소는 DATABASE_URL 환경변수에서만 읽습니다.
// 처음 쿼리할 때 연결하므로, DB가 잠시 꺼져 있어도 서버는 뜨고 /health가 상태를 알려 줍니다.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
