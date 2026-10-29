import { Controller, Get } from '@nestjs/common';
import { ItemsService } from '../items/items.service';

@Controller()
export class StatsController {
  constructor(private readonly items: ItemsService) {}

  // B12. 현황 숫자. 용품 목록(B2)과 같은 "지금 상태" 계산을 거치므로 목록과 숫자가 어긋나지 않습니다.
  // 신청 중인 용품도 지금 상태가 대여 가능이면 "대여 가능"에 포함됩니다 (신청은 상태를 바꾸지 않음).
  @Get('stats')
  async stats() {
    const items = await this.items.findAll();
    return {
      totalItems: items.length,
      rented: items.filter((item) => item.status === 'RENTED').length,
      available: items.filter((item) => item.status === 'AVAILABLE').length,
    };
  }
}
