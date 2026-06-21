import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceId } from '../common/decorators/workspace-id.decorator';
import { WorkspaceIdPipe } from '../common/pipes/workspace-id.pipe';
import { AuditLogsService } from './audit-logs.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { Throttle, minutes } from '@nestjs/throttler';

@ApiTags('Audit Logs')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  description: 'The active Workspace ID',
  required: true,
})
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Roles('OWNER')
@Controller('audit-logs')
@Throttle({ default: { limit: 30, ttl: minutes(1) } })
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs for workspace (OWNER only)' })
  @ApiResponse({ status: 200, description: 'Audit logs retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Access denied or insufficient roles' })
  findAll(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Query() query: AuditLogQueryDto,
  ) {
    return this.auditLogsService.findAll(workspaceId, query);
  }
}
