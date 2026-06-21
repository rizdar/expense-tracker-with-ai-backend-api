import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Workspaces')
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspacesService: WorkspacesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get list of workspaces for current user' })
  @ApiResponse({ status: 200, description: 'List of workspaces retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getWorkspaces(@Req() req: any, @Query() query: PaginationDto) {
    const userId = req.user.id;
    return this.workspacesService.getWorkspaces(userId, query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create new workspace' })
  @ApiBody({
    type: CreateWorkspaceDto,
    examples: {
      default: {
        summary: 'Example Create Workspace Payload',
        value: {
          name: 'My UMKM Store',
          type: 'UMKM',
          currency: 'IDR',
          timezone: 'Asia/Jakarta',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Workspace created successfully.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async createWorkspace(@Req() req: any, @Body() dto: CreateWorkspaceDto) {
    const userId = req.user.id;
    return this.workspacesService.createWorkspace(userId, dto);
  }

  @Get('invite/:token')
  @ApiOperation({ summary: 'Get invitation details (Public)' })
  @ApiResponse({ status: 200, description: 'Invitation details retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  async getInvitationInfo(@Param('token') token: string) {
    return this.workspacesService.getInvitationInfo(token);
  }

  @Post('invite/:token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept workspace invitation' })
  @ApiResponse({ status: 200, description: 'Invitation accepted successfully.' })
  @ApiResponse({ status: 400, description: 'Invitation expired or already accepted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Invitation email does not match user account.' })
  @ApiResponse({ status: 404, description: 'Invitation not found.' })
  async acceptInvitation(@Req() req: any, @Param('token') token: string) {
    const userId = req.user.id;
    const userEmail = req.user.email;
    return this.workspacesService.acceptInvitation(token, userId, userEmail);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get workspace details' })
  @ApiResponse({ status: 200, description: 'Workspace details retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async getWorkspaceById(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.workspacesService.getWorkspaceById(id, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update workspace metadata' })
  @ApiBody({
    type: UpdateWorkspaceDto,
    examples: {
      default: {
        summary: 'Example Update Workspace Payload',
        value: {
          name: 'Updated UMKM Store Name',
          type: 'ORGANIZATION',
          currency: 'USD',
          timezone: 'UTC',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied / Insufficient role privileges.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async updateWorkspace(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspacesService.updateWorkspace(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles('OWNER')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Soft delete workspace' })
  @ApiResponse({ status: 200, description: 'Workspace soft-deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot delete workspace with other members.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied / Insufficient role privileges.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async softDeleteWorkspace(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.workspacesService.softDeleteWorkspace(id, userId);
  }

  @Post(':id/restore')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles('OWNER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore soft-deleted workspace' })
  @ApiResponse({ status: 200, description: 'Workspace restored successfully.' })
  @ApiResponse({ status: 400, description: 'Workspace is not deleted.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied / Insufficient role privileges.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async restoreWorkspace(@Req() req: any, @Param('id') id: string) {
    const userId = req.user.id;
    return this.workspacesService.restoreWorkspace(id, userId);
  }

  @Post(':id/transfer-ownership')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles('OWNER')
  @ApiBearerAuth('JWT-auth')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Transfer workspace ownership' })
  @ApiBody({
    type: TransferOwnershipDto,
    examples: {
      default: {
        summary: 'Example Transfer Ownership Payload',
        value: {
          newOwnerId: 'd3b07384-d113-4ec2-a5d6-c7027b578a51',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Ownership transferred successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid transfer target or input.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied / Insufficient role privileges.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async transferOwnership(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: TransferOwnershipDto,
  ) {
    const currentOwnerId = req.user.id;
    return this.workspacesService.transferOwnership(id, currentOwnerId, dto.newOwnerId);
  }

  @Get(':id/members')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get list of members in workspace' })
  @ApiResponse({ status: 200, description: 'List of members retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async getMembers(@Param('id') id: string) {
    return this.workspacesService.getMembers(id);
  }

  @Put(':id/members/:memberId')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update workspace member role' })
  @ApiBody({
    type: UpdateMemberRoleDto,
    examples: {
      default: {
        summary: 'Example Update Member Role Payload',
        value: {
          role: 'ADMIN',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Member role updated successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot modify Owner role / invalid input.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied / Insufficient role privileges.' })
  @ApiResponse({ status: 404, description: 'Workspace or member not found.' })
  async updateMemberRole(
    @Req() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const callerId = req.user.id;
    const callerRole = req.workspaceRole;
    return this.workspacesService.updateMemberRole(id, callerId, callerRole, memberId, dto.role);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Kick member from workspace' })
  @ApiResponse({ status: 200, description: 'Member kicked successfully.' })
  @ApiResponse({ status: 400, description: 'Cannot kick Owner.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied / Insufficient role privileges.' })
  @ApiResponse({ status: 404, description: 'Workspace or member not found.' })
  async kickMember(
    @Req() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
  ) {
    const callerId = req.user.id;
    const callerRole = req.workspaceRole;
    return this.workspacesService.kickMember(id, callerId, callerRole, memberId);
  }

  @Post(':id/invite')
  @UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
  @Roles('OWNER', 'ADMIN')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Invite a new member to workspace' })
  @ApiBody({
    type: InviteMemberDto,
    examples: {
      default: {
        summary: 'Example Invite Member Payload',
        value: {
          email: 'newmember@example.com',
          role: 'VIEWER',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Invitation sent successfully.' })
  @ApiResponse({ status: 400, description: 'User already a member / active invitation exists / validation failed.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 403, description: 'Access denied / Insufficient role privileges.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async inviteMember(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    const inviterId = req.user.id;
    return this.workspacesService.inviteMember(id, inviterId, dto);
  }
}
