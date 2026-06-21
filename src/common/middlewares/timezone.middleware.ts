import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TimezoneMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: any, res: Response, next: NextFunction) {
    let timezone = req.headers['x-timezone'] as string;

    if (!timezone) {
      const workspaceId = req.headers['x-workspace-id'] as string;
      if (workspaceId) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(workspaceId)) {
          const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { timezone: true },
          });
          if (workspace) {
            timezone = workspace.timezone;
          }
        }
      }
    }

    req.timezone = timezone || 'UTC';
    next();
  }
}
