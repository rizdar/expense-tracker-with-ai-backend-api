import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { SKIP_AUDIT_KEY } from '../decorators/skip-audit.decorator';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest();
    const method = req.method;
    const url = req.url;

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isExport = url.includes('/reports/export');

    if (!isMutation && !isExport) {
      return next.handle();
    }

    // Skip auth routes (handled internally or not relevant for data audit)
    if (
      url.includes('/auth/login') ||
      url.includes('/auth/logout') ||
      url.includes('/auth/register') ||
      url.includes('/auth/verify-email') ||
      url.includes('/auth/resend-verification') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password')
    ) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response) => {
          this.logAction(req, response).catch((err) => {
            console.error('AuditLogInterceptor failed to write log:', err.message);
          });
        },
      }),
    );
  }

  private async logAction(req: any, response: any) {
    const actorId = req.user?.id || null;

    let workspaceId = (req.headers['x-workspace-id'] as string) || null;
    if (!workspaceId && req.workspace?.id) {
      workspaceId = req.workspace.id;
    }

    const method = req.method;
    const url = req.url;

    let action = 'CREATE';
    if (url.includes('/permanent') && method === 'DELETE') {
      action = 'PERMANENT_DELETE';
    } else if (url.includes('/reports/export')) {
      action = 'EXPORT';
    } else if (method === 'PUT' || method === 'PATCH') {
      action = 'UPDATE';
    } else if (method === 'DELETE') {
      action = 'DELETE';
    }

    let entity = 'Unknown';
    if (url.includes('/transactions')) entity = 'Transaction';
    else if (url.includes('/categories')) entity = 'Category';
    else if (url.includes('/budgets')) entity = 'Budget';
    else if (url.includes('/workspaces')) entity = 'Workspace';
    else if (url.includes('/attachments')) entity = 'Attachment';
    else if (url.includes('/devices')) entity = 'DeviceToken';
    else if (url.includes('/reports/export')) entity = 'Report';

    if (entity === 'Unknown') return;

    const entityId = response?.data?.id || response?.id || req.params?.id || 'unknown';

    let changes: any = null;
    if (action === 'UPDATE') {
      changes = { body: req.body };
    }

    const ipAddress = req.ip || req.connection?.remoteAddress || null;

    await this.prisma.auditLog.create({
      data: {
        actorId,
        workspaceId,
        action,
        entity,
        entityId,
        changes: changes ? JSON.parse(JSON.stringify(changes)) : null,
        ipAddress,
      },
    });
  }
}
