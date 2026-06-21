import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard, minutes } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { AiModule } from './ai/ai.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CronModule } from './cron/cron.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { TimezoneMiddleware } from './common/middlewares/timezone.middleware';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: minutes(1),
        limit: 100,
      },
    ]),
    PrismaModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    CategoriesModule,
    TransactionsModule,
    AiModule,
    BudgetsModule,
    CronModule,
    AuditLogsModule,
    AttachmentsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TimezoneMiddleware).forRoutes('*');
  }
}


