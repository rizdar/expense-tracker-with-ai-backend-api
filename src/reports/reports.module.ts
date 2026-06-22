import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { RoleCheckerService } from '../common/services/role-checker.service';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';

@Module({
  imports: [PrismaModule, AuthModule, BudgetsModule],
  controllers: [ReportsController],
  providers: [ReportsService, WorkspaceRoleGuard, RoleCheckerService],
})
export class ReportsModule {}
