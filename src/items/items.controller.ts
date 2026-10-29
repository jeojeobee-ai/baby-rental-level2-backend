import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { parseId } from '../common/validation';
import { ITEM_NOT_FOUND, ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  findAll() {
    return this.items.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.items.findOne(parseId(id, ITEM_NOT_FOUND));
  }

  @Post()
  create(@Body() body: unknown) {
    return this.items.create(body);
  }
}
