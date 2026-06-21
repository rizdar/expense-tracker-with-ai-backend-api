import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RoleCheckerService {
  constructor(private readonly prisma: PrismaService) {}

  async checkRole(workspaceId: string, userId: string, allowedRoles: string[]) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId,
          workspaceId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    if (!allowedRoles.includes(member.role)) {
      throw new ForbiddenException('Insufficient role privileges');
    }
    return member;
  }
}
