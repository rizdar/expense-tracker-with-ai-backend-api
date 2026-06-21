import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    PrismaModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    CategoriesModule,
    TransactionsModule,
    AiModule,
  ],
})
export class AppModule {}
