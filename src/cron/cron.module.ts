import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { FcmModule } from '../fcm/fcm.module';
import { BudgetAlertService } from './budget-alert.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrismaModule,
    BudgetsModule,
    FcmModule,
  ],
  providers: [BudgetAlertService],
})
export class CronModule {}
