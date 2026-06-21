import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async create(workspaceId: string, transactionId: string, file: Express.Multer.File) {
    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id: transactionId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!transaction) {
      throw new BadRequestException('Transaction not found in this workspace');
    }

    const attachmentCount = await this.prisma.attachment.count({
      where: {
        transactionId,
      },
    });

    if (attachmentCount >= 5) {
      throw new BadRequestException('Maximum of 5 attachments allowed per transaction');
    }

    const { url, fileName } = await this.storage.uploadFile(file, workspaceId);

    const attachment = await this.prisma.attachment.create({
      data: {
        transactionId,
        fileName,
        fileUrl: url,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      },
    });

    return {
      success: true,
      message: 'Attachment uploaded successfully',
      data: attachment,
    };
  }

  async findOne(id: string, workspaceId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        transaction: true,
      },
    });

    if (!attachment || attachment.transaction.workspaceId !== workspaceId || attachment.transaction.deletedAt !== null) {
      throw new NotFoundException('Attachment not found');
    }

    const { transaction, ...data } = attachment;

    return {
      success: true,
      message: 'Attachment retrieved successfully',
      data,
    };
  }

  async getDownloadInfo(id: string, workspaceId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        transaction: true,
      },
    });

    if (!attachment || attachment.transaction.workspaceId !== workspaceId || attachment.transaction.deletedAt !== null) {
      throw new NotFoundException('Attachment not found');
    }

    const downloadInfo = await this.storage.getDownloadUrl(attachment.fileUrl);
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      info: downloadInfo,
    };
  }

  async delete(id: string, workspaceId: string) {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id },
      include: {
        transaction: true,
      },
    });

    if (!attachment || attachment.transaction.workspaceId !== workspaceId || attachment.transaction.deletedAt !== null) {
      throw new NotFoundException('Attachment not found');
    }

    await this.storage.deleteFile(attachment.fileUrl);

    await this.prisma.attachment.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Attachment deleted successfully',
    };
  }
}
