import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { parseId } from '../common/validation';
import { ITEM_NOT_FOUND } from '../items/items.service';
import { REQUEST_NOT_FOUND, RequestsService } from './requests.service';

@Controller()
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post('items/:id/requests')
  create(@Param('id') id: string, @Body() body: unknown) {
    return this.requests.create(parseId(id, ITEM_NOT_FOUND), body);
  }

  @Get('requests')
  findAll(@Query('status') status?: string) {
    return this.requests.findAll(status);
  }

  @Patch('requests/:id/cancel')
  cancel(@Param('id') id: string) {
    return this.requests.cancel(parseId(id, REQUEST_NOT_FOUND));
  }

  @Post('requests/:id/approve')
  approve(@Param('id') id: string) {
    return this.requests.approve(parseId(id, REQUEST_NOT_FOUND));
  }
}
