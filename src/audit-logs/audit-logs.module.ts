import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AuditLogsController],
  providers: [AuditLogsService, WorkspaceRoleGuard],
  exports: [AuditLogsService],
})
export class AuditLogsModule {}
