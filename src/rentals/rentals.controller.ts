import { Body, Controller, Param, Patch, Post } from '@nestjs/common';
import { parseId } from '../common/validation';
import { ITEM_NOT_FOUND } from '../items/items.service';
import { RENTAL_NOT_FOUND, RentalsService } from './rentals.service';

@Controller()
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Post('items/:id/rentals')
  create(@Param('id') id: string, @Body() body: unknown) {
    return this.rentals.create(parseId(id, ITEM_NOT_FOUND), body);
  }

  @Patch('rentals/:id/return')
  markReturned(@Param('id') id: string, @Body() body: unknown) {
    return this.rentals.markReturned(parseId(id, RENTAL_NOT_FOUND), body);
  }
}
