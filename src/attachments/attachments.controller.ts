import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { WorkspaceId } from '../common/decorators/workspace-id.decorator';
import { WorkspaceIdPipe } from '../common/pipes/workspace-id.pipe';
import { FileValidationPipe } from '../common/pipes/file-validation.pipe';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { Throttle, minutes } from '@nestjs/throttler';

@ApiTags('Attachments')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  description: 'The active Workspace ID',
  required: true,
})
@UseGuards(JwtAuthGuard, WorkspaceRoleGuard)
@Controller('attachments')
@Throttle({ default: { limit: 30, ttl: minutes(1) } })
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload an attachment for a transaction (max 5 attachments per transaction)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Attachment file (JPEG, PNG, HEIC, PDF; max 10MB)',
        },
        transactionId: {
          type: 'string',
          format: 'uuid',
          description: 'The transaction ID to attach the file to',
        },
      },
      required: ['file', 'transactionId'],
    },
  })
  @ApiResponse({ status: 201, description: 'Attachment uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file upload or transaction context' })
  @ApiResponse({ status: 403, description: 'Access denied or workspace mismatch' })
  create(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Body() dto: CreateAttachmentDto,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
  ) {
    return this.attachmentsService.create(workspaceId, dto.transactionId, file);
  }

  @Get(':id')
  @Throttle({ default: { limit: 60, ttl: minutes(1) } })
  @ApiOperation({ summary: 'Get attachment metadata by ID' })
  @ApiResponse({ status: 200, description: 'Attachment metadata retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  findOne(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
  ) {
    return this.attachmentsService.findOne(id, workspaceId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download the attachment file' })
  @ApiResponse({ status: 200, description: 'S3: Returns JSON containing presigned URL. Local: Streams the file directly' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async download(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Res() res: Response,
  ) {
    const downloadInfo = await this.attachmentsService.getDownloadInfo(id, workspaceId);
    if ('url' in downloadInfo.info) {
      return res.json({
        success: true,
        url: downloadInfo.info.url,
      });
    } else {
      res.set({
        'Content-Type': downloadInfo.mimeType,
        'Content-Disposition': `attachment; filename="${downloadInfo.fileName}"`,
      });
      downloadInfo.info.stream.pipe(res);
    }
  }

  @Delete(':id')
  @Roles('OWNER', 'ADMIN')
  @ApiOperation({ summary: 'Delete attachment (OWNER/ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Attachment deleted successfully' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  delete(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
  ) {
    return this.attachmentsService.delete(id, workspaceId);
  }
}
