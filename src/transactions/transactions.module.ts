import { Module } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RoleCheckerService } from '../common/services/role-checker.service';

@Module({
  imports: [PrismaModule],
  providers: [TransactionsService, RoleCheckerService],
  controllers: [TransactionsController]
})
export class TransactionsModule {}
