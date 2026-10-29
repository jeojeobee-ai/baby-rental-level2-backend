import { Body, Controller, Param, Post } from '@nestjs/common';
import { parseId } from '../common/validation';
import { ITEM_NOT_FOUND } from '../items/items.service';
import { SanitizationsService } from './sanitizations.service';

@Controller('items/:id/sanitizations')
export class SanitizationsController {
  constructor(private readonly sanitizations: SanitizationsService) {}

  @Post()
  create(@Param('id') id: string, @Body() body: unknown) {
    return this.sanitizations.create(parseId(id, ITEM_NOT_FOUND), body);
  }
}
