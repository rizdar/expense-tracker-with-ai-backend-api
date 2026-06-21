import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [WorkspacesService, WorkspaceRoleGuard],
  controllers: [WorkspacesController],
  exports: [WorkspacesService],
})
export class WorkspacesModule {}
