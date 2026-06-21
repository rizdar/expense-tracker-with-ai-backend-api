import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  Headers,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceId } from '../common/decorators/workspace-id.decorator';
import { WorkspaceIdPipe } from '../common/pipes/workspace-id.pipe';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { QuotaService } from './quota.service';
import { ParseChatDto } from './dto/parse-chat.dto';
import { InsightsQueryDto } from './dto/insights-query.dto';
import { Throttle, minutes } from '@nestjs/throttler';

@ApiTags('AI')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  description: 'The active Workspace ID',
  required: true,
})
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Controller('ai')
@Throttle({ default: { limit: 30, ttl: minutes(1) } })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly quotaService: QuotaService,
  ) {}

  @Post('parse-chat')
  @ApiOperation({ summary: 'Parse transaction details from chat input text' })
  @ApiResponse({ status: 201, description: 'Text parsed successfully into transaction draft' })
  @ApiResponse({ status: 429, description: 'AI daily quota limit exceeded' })
  @ApiResponse({ status: 422, description: 'AI parsing failed' })
  parseChat(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: ParseChatDto,
    @Headers('x-ai-model') modelOverride?: string,
  ) {
    return this.aiService.parseChat(req.user.id, workspaceId, dto.text, modelOverride);
  }

  @Post('parse-receipt')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Parse transaction details from uploaded receipt (image/PDF)' })
  @ApiResponse({ status: 201, description: 'Receipt parsed successfully into transaction draft' })
  @ApiResponse({ status: 400, description: 'Invalid file upload or model cannot handle vision' })
  @ApiResponse({ status: 429, description: 'AI daily quota limit exceeded' })
  @ApiResponse({ status: 422, description: 'AI parsing failed' })
  parseReceipt(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
    @Headers('x-ai-model') modelOverride?: string,
  ) {
    return this.aiService.parseReceipt(req.user.id, workspaceId, file, modelOverride);
  }

  @Get('insights')
  @ApiOperation({ summary: 'Get AI analytics, spend patterns and duplicate detection' })
  @ApiResponse({ status: 200, description: 'Financial insights generated successfully' })
  @ApiResponse({ status: 429, description: 'AI daily quota limit exceeded' })
  getInsights(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Query() query: InsightsQueryDto,
  ) {
    return this.aiService.getInsights(req.user.id, workspaceId, query.startDate, query.endDate);
  }

  @Get('quota')
  @ApiOperation({ summary: 'Check remaining AI daily quota for user' })
  @ApiResponse({ status: 200, description: 'Quota details returned successfully' })
  async getQuota(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
  ) {
    const quota = await this.quotaService.getRemainingQuota(req.user.id);
    return {
      success: true,
      data: quota,
    };
  }
}
