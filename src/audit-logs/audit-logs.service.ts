import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(workspaceId: string, query: AuditLogQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      order = 'desc',
      entity,
      action,
      actorId,
    } = query;

    const where: any = {
      workspaceId,
    };

    if (entity) {
      where.entity = entity;
    }

    if (action) {
      where.action = action;
    }

    if (actorId) {
      where.actorId = actorId;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: order,
        },
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
