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
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators/workspace-id.decorator';
import { WorkspaceIdPipe } from '../common/pipes/workspace-id.pipe';
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { PermanentDeleteTransactionDto } from './dto/permanent-delete-transaction.dto';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import { Throttle, minutes } from '@nestjs/throttler';

@SkipAudit()
@ApiTags('Transactions')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  description: 'The active Workspace ID',
  required: true,
})
@UseGuards(JwtAuthGuard)
@Controller('transactions')
@Throttle({ default: { limit: 60, ttl: minutes(1) } })
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a transaction' })
  @ApiResponse({ status: 201, description: 'Transaction created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or category' })
  @ApiResponse({ status: 403, description: 'Access denied or insufficient roles' })
  create(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(workspaceId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all transactions for workspace' })
  @ApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  findAll(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Query() query: TransactionQueryDto,
  ) {
    return this.transactionsService.findAll(workspaceId, req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction detail' })
  @ApiResponse({ status: 200, description: 'Transaction retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  findOne(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
  ) {
    return this.transactionsService.findOne(id, workspaceId, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction updated successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  update(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, workspaceId, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction soft deleted successfully' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  remove(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
  ) {
    return this.transactionsService.softDelete(id, workspaceId, req.user.id);
  }

  @Delete(':id/permanent')
  @ApiOperation({ summary: 'Permanently delete a transaction' })
  @ApiResponse({ status: 200, description: 'Transaction permanently deleted successfully' })
  @ApiResponse({ status: 403, description: 'Only OWNER can permanently delete a transaction' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  permanentRemove(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: PermanentDeleteTransactionDto,
  ) {
    return this.transactionsService.permanentDelete(id, workspaceId, req.user.id, dto);
  }
}
