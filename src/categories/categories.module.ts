import { Module } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CategoriesController } from './categories.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RoleCheckerService } from '../common/services/role-checker.service';

@Module({
  imports: [PrismaModule],
  providers: [CategoriesService, RoleCheckerService],
  controllers: [CategoriesController]
})
export class CategoriesModule {}
