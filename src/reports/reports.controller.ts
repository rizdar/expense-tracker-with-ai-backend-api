import {
  Controller,
  Get,
  Query,
  UseGuards,
  Req,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceId } from '../common/decorators/workspace-id.decorator';
import { WorkspaceIdPipe } from '../common/pipes/workspace-id.pipe';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { Throttle, minutes } from '@nestjs/throttler';
import type { Response } from 'express';

@ApiTags('Reports')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  description: 'The active Workspace ID',
  required: true,
})
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('summary')
  @Throttle({ default: { limit: 30, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Get financial summary and budget comparison' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date filter (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date filter (ISO format)' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully' })
  async getSummary(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Query() query: ReportQueryDto,
  ) {
    return this.reportsService.getSummary(
      workspaceId,
      req.user.id,
      query.startDate,
      query.endDate,
    );
  }

  @Get('export')
  @Throttle({ default: { limit: 5, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Export transactions data as CSV or PDF' })
  @ApiQuery({ name: 'format', required: true, enum: ['csv', 'pdf'], description: 'Export format' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date filter (ISO format)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date filter (ISO format)' })
  @ApiResponse({ status: 200, description: 'File exported successfully' })
  async export(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Query() query: ReportQueryDto,
    @Res() res: Response,
  ) {
    if (!query.format) {
      throw new BadRequestException('format query param is required (csv | pdf)');
    }

    if (query.format === 'csv') {
      const buffer = await this.reportsService.exportCsv(
        workspaceId,
        req.user.id,
        query.startDate,
        query.endDate,
      );
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="report.csv"',
      });
      res.send(buffer);
    } else if (query.format === 'pdf') {
      const buffer = await this.reportsService.exportPdf(
        workspaceId,
        req.user.id,
        query.startDate,
        query.endDate,
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="report.pdf"',
      });
      res.send(buffer);
    } else {
      throw new BadRequestException('format query param must be csv or pdf');
    }
  }
}
