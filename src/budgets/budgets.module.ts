import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { BudgetsService } from './budgets.service';
import { BudgetsController } from './budgets.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [BudgetsController],
  providers: [BudgetsService, WorkspaceRoleGuard],
  exports: [BudgetsService],
})
export class BudgetsModule {}
