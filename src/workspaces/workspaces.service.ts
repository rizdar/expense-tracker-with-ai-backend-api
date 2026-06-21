import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { FcmService } from '../fcm/fcm.service';
import * as crypto from 'crypto';

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmService: FcmService,
  ) {}

  // 1. Create Workspace
  async createWorkspace(userId: string, dto: CreateWorkspaceDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // Create Workspace
      const workspace = await tx.workspace.create({
        data: {
          name: dto.name,
          type: dto.type,
          currency: dto.currency ?? 'IDR',
          timezone: dto.timezone ?? 'UTC',
        },
      });

      // Link User to Workspace as OWNER
      await tx.workspaceMember.create({
        data: {
          userId,
          workspaceId: workspace.id,
          role: 'OWNER',
        },
      });

      // Seeding Default Categories
      const defaultCategories = [
        // EXPENSE
        { name: 'Food & Beverage', type: 'EXPENSE' },
        { name: 'Transportation', type: 'EXPENSE' },
        { name: 'Shopping', type: 'EXPENSE' },
        { name: 'Bills & Utilities', type: 'EXPENSE' },
        { name: 'Entertainment', type: 'EXPENSE' },
        { name: 'Health', type: 'EXPENSE' },
        // INCOME
        { name: 'Salary', type: 'INCOME' },
        { name: 'Investment', type: 'INCOME' },
        { name: 'Freelance', type: 'INCOME' },
        { name: 'Bonus', type: 'INCOME' },
        { name: 'Other', type: 'INCOME' },
      ];

      await tx.category.createMany({
        data: defaultCategories.map((cat) => ({
          workspaceId: workspace.id,
          name: cat.name,
          type: cat.type,
        })),
      });

      return workspace;
    });

    return {
      success: true,
      message: 'Workspace created successfully with default categories.',
      data: result,
    };
  }

  // 2. Get Workspaces of User
  async getWorkspaces(userId: string, pagination: PaginationDto) {
    const { page, limit, sortBy, order } = pagination;
    const skip = (page - 1) * limit;

    const ALLOWED_SORT_COLUMNS = ['name', 'type', 'currency', 'timezone', 'createdAt', 'updatedAt'];
    const orderColumn = sortBy && ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : 'createdAt';

    const whereClause = {
      deletedAt: null,
      members: {
        some: {
          userId,
        },
      },
    };

    const [total, data] = await Promise.all([
      this.prisma.workspace.count({ where: whereClause }),
      this.prisma.workspace.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [orderColumn]: order },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Workspaces retrieved successfully.',
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 3. Get Workspace by ID
  async getWorkspaceById(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const member = workspace.members.find((m) => m.userId === userId);
    if (!member) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    if (workspace.deletedAt !== null) {
      if (member.role !== 'OWNER') {
        throw new NotFoundException('Workspace not found');
      }
    }

    return {
      success: true,
      message: 'Workspace details retrieved successfully.',
      data: workspace,
    };
  }

  // 4. Update Workspace
  async updateWorkspace(workspaceId: string, dto: UpdateWorkspaceDto) {
    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        name: dto.name,
        type: dto.type,
        currency: dto.currency,
        timezone: dto.timezone,
      },
    });

    return {
      success: true,
      message: 'Workspace updated successfully.',
      data: updated,
    };
  }

  // 5. Soft Delete Workspace (OWNER only, check member count is 1)
  async softDeleteWorkspace(workspaceId: string, userId: string) {
    const membersCount = await this.prisma.workspaceMember.count({
      where: { workspaceId },
    });

    if (membersCount > 1) {
      throw new BadRequestException(
        'Cannot delete workspace with other members. Please kick other members first.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { deletedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'DELETE',
          entity: 'Workspace',
          entityId: workspaceId,
          changes: { deletedAt: new Date().toISOString() },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Workspace soft-deleted successfully.',
    };
  }

  // 6. Restore Workspace (OWNER only)
  async restoreWorkspace(workspaceId: string, userId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.deletedAt === null) {
      throw new BadRequestException('Workspace is not deleted');
    }

    await this.prisma.$transaction([
      this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { deletedAt: null },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'CREATE',
          entity: 'Workspace',
          entityId: workspaceId,
          changes: { restoredAt: new Date().toISOString() },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Workspace restored successfully.',
    };
  }

  // 7. Transfer Ownership (OWNER only)
  async transferOwnership(
    workspaceId: string,
    currentOwnerId: string,
    newOwnerId: string,
  ) {
    if (newOwnerId === currentOwnerId) {
      throw new BadRequestException('Cannot transfer ownership to yourself');
    }

    const targetMember = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: newOwnerId,
          workspaceId,
        },
      },
    });

    if (!targetMember) {
      throw new BadRequestException('Target user is not a member of this workspace');
    }

    if (targetMember.role !== 'ADMIN') {
      throw new BadRequestException('Target user must be an ADMIN of this workspace');
    }

    await this.prisma.$transaction([
      this.prisma.workspaceMember.update({
        where: {
          userId_workspaceId: {
            userId: currentOwnerId,
            workspaceId,
          },
        },
        data: { role: 'ADMIN' },
      }),
      this.prisma.workspaceMember.update({
        where: {
          userId_workspaceId: {
            userId: newOwnerId,
            workspaceId,
          },
        },
        data: { role: 'OWNER' },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: currentOwnerId,
          workspaceId,
          action: 'TRANSFER_OWNERSHIP',
          entity: 'Workspace',
          entityId: workspaceId,
          changes: {
            before: { owner: currentOwnerId },
            after: { owner: newOwnerId },
          },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Workspace ownership transferred successfully.',
    };
  }

  // 8. Get Workspace Members
  async getMembers(workspaceId: string) {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        joinedAt: 'asc',
      },
    });

    return {
      success: true,
      message: 'Members retrieved successfully.',
      data: members,
    };
  }

  // 9. Update Member Role (OWNER or ADMIN only)
  async updateMemberRole(
    workspaceId: string,
    callerId: string,
    callerRole: string,
    memberId: string,
    newRole: 'ADMIN' | 'VIEWER',
  ) {
    const memberToUpdate = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: memberId,
          workspaceId,
        },
      },
    });

    if (!memberToUpdate) {
      throw new NotFoundException('Member not found in this workspace');
    }

    if (memberToUpdate.role === 'OWNER') {
      throw new BadRequestException('Cannot modify the role of the OWNER');
    }

    await this.prisma.$transaction([
      this.prisma.workspaceMember.update({
        where: {
          userId_workspaceId: {
            userId: memberId,
            workspaceId,
          },
        },
        data: { role: newRole },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: callerId,
          workspaceId,
          action: 'UPDATE',
          entity: 'WorkspaceMember',
          entityId: memberId,
          changes: { before: { role: memberToUpdate.role }, after: { role: newRole } },
        },
      }),
    ]);

    return {
      success: true,
      message: `Member role updated to ${newRole} successfully.`,
    };
  }

  // 10. Kick Member (OWNER or ADMIN, but cannot kick OWNER, and ADMIN cannot kick other ADMINS)
  async kickMember(
    workspaceId: string,
    callerId: string,
    callerRole: string,
    memberId: string,
  ) {
    const memberToKick = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: memberId,
          workspaceId,
        },
      },
    });

    if (!memberToKick) {
      throw new NotFoundException('Member not found in this workspace');
    }

    if (memberToKick.role === 'OWNER') {
      throw new BadRequestException('Cannot kick the OWNER of the workspace');
    }

    if (callerRole === 'ADMIN') {
      if (memberToKick.role === 'ADMIN') {
        throw new ForbiddenException('ADMIN cannot kick another ADMIN');
      }
    }

    await this.prisma.$transaction([
      this.prisma.workspaceMember.delete({
        where: {
          userId_workspaceId: {
            userId: memberId,
            workspaceId,
          },
        },
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: callerId,
          workspaceId,
          action: 'DELETE',
          entity: 'WorkspaceMember',
          entityId: memberId,
          changes: { kickedRole: memberToKick.role },
        },
      }),
    ]);

    return {
      success: true,
      message: 'Member kicked from workspace successfully.',
    };
  }

  // 11. Invite Member
  async inviteMember(
    workspaceId: string,
    inviterId: string,
    dto: InviteMemberDto,
  ) {
    const { email, role } = dto;

    const targetUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (targetUser) {
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: {
          userId_workspaceId: {
            userId: targetUser.id,
            workspaceId,
          },
        },
      });

      if (existingMember) {
        throw new BadRequestException('User is already a member of this workspace');
      }
    }

    const existingInvitation = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email,
        status: 'PENDING',
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingInvitation) {
      throw new BadRequestException('An active invitation for this email already exists');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    const invitation = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId,
        inviterId,
        email,
        role,
        token,
        expiresAt,
      },
    });

    // Send push notification if target user is registered
    if (targetUser) {
      const deviceTokens = await this.prisma.deviceToken.findMany({
        where: { userId: targetUser.id },
      });

      if (deviceTokens.length > 0) {
        const workspace = await this.prisma.workspace.findUnique({
          where: { id: workspaceId },
          select: { name: true },
        });

        await this.fcmService.sendToUser(targetUser.id, deviceTokens.map((d) => d.token), {
          title: 'Workspace Invitation',
          body: `You've been invited to join workspace '${workspace?.name || 'Unknown'}' as ${dto.role}.`,
          data: {
            type: 'WORKSPACE_INVITATION',
            invitationToken: token,
            workspaceName: workspace?.name || '',
          },
        });
      }
    }

    console.log(`[EMAIL SIMULATION] Invitation sent to ${email} with token: ${token}`);
    // TODO: Replace with MailService.sendInvitation() when mail module is ready

    return {
      success: true,
      message: 'Invitation sent successfully.',
      data: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  // 12. Get Invitation Info (Public)
  async getInvitationInfo(token: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            name: true,
          },
        },
        inviter: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    const isExpired = new Date() > invitation.expiresAt;
    let status = invitation.status;

    if (status === 'PENDING' && isExpired) {
      await this.prisma.workspaceInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      status = 'EXPIRED';
    }

    return {
      success: true,
      message: 'Invitation details retrieved.',
      data: {
        workspaceName: invitation.workspace.name,
        role: invitation.role,
        inviterName: invitation.inviter?.name ?? 'Unknown',
        inviterEmail: invitation.inviter?.email ?? 'Unknown',
        status,
        expiresAt: invitation.expiresAt,
      },
    };
  }

  // 13. Accept Invitation
  async acceptInvitation(token: string, userId: string, userEmail: string) {
    const invitation = await this.prisma.workspaceInvitation.findUnique({
      where: { token },
    });

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    if (invitation.status !== 'PENDING' || new Date() > invitation.expiresAt) {
      throw new BadRequestException('Invitation is expired or already processed');
    }

    if (userEmail !== invitation.email) {
      throw new ForbiddenException('Invitation email does not match your account');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workspaceMember.create({
        data: {
          userId,
          workspaceId: invitation.workspaceId,
          role: invitation.role,
        },
      });

      await tx.workspaceInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
        },
      });
    });

    return {
      success: true,
      message: 'Invitation accepted successfully. You are now a member of the workspace.',
    };
  }
}
