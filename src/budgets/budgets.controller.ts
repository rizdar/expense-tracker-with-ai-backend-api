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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceId } from '../common/decorators/workspace-id.decorator';
import { WorkspaceIdPipe } from '../common/pipes/workspace-id.pipe';
import { BudgetsService } from './budgets.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { Throttle, minutes } from '@nestjs/throttler';

@ApiTags('Budgets')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  description: 'The active Workspace ID',
  required: true,
})
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Controller('budgets')
@Throttle({ default: { limit: 60, ttl: minutes(1) } })
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Post()
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Create a budget (OWNER/ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Budget created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or category' })
  @ApiResponse({ status: 403, description: 'Access denied or insufficient roles' })
  create(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: CreateBudgetDto,
  ) {
    return this.budgetsService.create(workspaceId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all budgets for workspace' })
  @ApiResponse({ status: 200, description: 'Budgets retrieved successfully' })
  findAll(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Query() query: BudgetQueryDto,
  ) {
    return this.budgetsService.findAll(workspaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get budget detail' })
  @ApiResponse({ status: 200, description: 'Budget retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  findOne(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
  ) {
    return this.budgetsService.findOne(id, workspaceId);
  }

  @Put(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Update a budget (OWNER/ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Budget updated successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  update(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, workspaceId, req.user.id, dto);
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Soft delete a budget (OWNER/ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Budget soft deleted successfully' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  remove(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
  ) {
    return this.budgetsService.softDelete(id, workspaceId, req.user.id);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get budget vs actual spending status' })
  @ApiResponse({ status: 200, description: 'Budget status details returned' })
  @ApiResponse({ status: 404, description: 'Budget not found' })
  getStatus(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
  ) {
    return this.budgetsService.getBudgetStatus(id, workspaceId);
  }
}
