import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';

@Module({
  imports: [PrismaModule, AuthModule, StorageModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, WorkspaceRoleGuard],
})
export class AttachmentsModule {}
