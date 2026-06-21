import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { QuotaService } from './quota.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { RoleCheckerService } from '../common/services/role-checker.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AiController],
  providers: [AiService, QuotaService, RoleCheckerService],
  exports: [AiService, QuotaService],
})
export class AiModule {}
