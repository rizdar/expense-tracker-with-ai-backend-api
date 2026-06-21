import { CanActivate, ExecutionContext, Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      return false;
    }

    const workspaceId = request.params.id;
    if (!workspaceId) {
      return true;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      throw new NotFoundException('Workspace not found');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: user.id,
          workspaceId: workspaceId,
        },
      },
    });

    if (!member) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    if (workspace.deletedAt !== null) {
      if (member.role !== 'OWNER') {
        throw new NotFoundException('Workspace not found');
      }
    }

    const requiredRoles = this.reflector.getAllAndOverride<('OWNER' | 'ADMIN' | 'VIEWER')[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.includes(member.role as any);
      if (!hasRole) {
        throw new ForbiddenException('Insufficient role privileges');
      }
    }

    request.workspace = workspace;
    request.workspaceRole = member.role;
    request.workspaceMember = member;

    return true;
  }
}
