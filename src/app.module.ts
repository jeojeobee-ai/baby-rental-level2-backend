import { Module } from '@nestjs/common';
import { HealthController } from './health/health.controller';
import { ItemsController } from './items/items.controller';
import { ItemsService } from './items/items.service';
import { PrismaModule } from './prisma/prisma.module';
import { RentalsController } from './rentals/rentals.controller';
import { RentalsService } from './rentals/rentals.service';
import { SanitizationsController } from './sanitizations/sanitizations.controller';
import { SanitizationsService } from './sanitizations/sanitizations.service';

@Module({
  imports: [PrismaModule],
  controllers: [HealthController, ItemsController, RentalsController, SanitizationsController],
  providers: [ItemsService, RentalsService, SanitizationsService],
})
export class AppModule {}
