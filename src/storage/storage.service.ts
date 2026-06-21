import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly driver: string;
  private readonly localPath: string;
  private s3Client: S3Client | null = null;
  private readonly s3Bucket: string;
  private readonly s3Region: string;
  private readonly s3PresignedExpiry: number;

  constructor() {
    this.driver = process.env.STORAGE_DRIVER || 'local';
    this.localPath = process.env.STORAGE_LOCAL_PATH || './uploads';
    this.s3Bucket = process.env.AWS_S3_BUCKET || '';
    this.s3Region = process.env.AWS_S3_REGION || 'ap-southeast-1';
    this.s3PresignedExpiry = parseInt(process.env.AWS_S3_PRESIGNED_EXPIRY || '900', 10);

    if (this.driver === 's3') {
      const accessKeyId = process.env.AWS_S3_ACCESS_KEY;
      const secretAccessKey = process.env.AWS_S3_SECRET_KEY;

      if (!accessKeyId || !secretAccessKey || !this.s3Bucket) {
        throw new InternalServerErrorException('AWS S3 configurations are missing in environment variables');
      }

      this.s3Client = new S3Client({
        region: this.s3Region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.heic':
        return 'image/heic';
      case '.heif':
        return 'image/heif';
      case '.pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  async uploadFile(file: Express.Multer.File, workspaceId: string): Promise<{ url: string; fileName: string }> {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      throw new BadRequestException('Invalid workspace ID');
    }

    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const fileName = `${randomUUID()}_${Date.now()}${ext}`;

    if (this.driver === 's3') {
      return this.uploadToS3(file, workspaceId, fileName);
    }
    return this.saveToLocal(file, workspaceId, fileName);
  }

  private async uploadToS3(file: Express.Multer.File, workspaceId: string, fileName: string): Promise<{ url: string; fileName: string }> {
    const key = `${workspaceId}/${fileName}`;
    try {
      const command = new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client!.send(command);
      const url = `https://${this.s3Bucket}.s3.${this.s3Region}.amazonaws.com/${key}`;
      return { url, fileName: file.originalname };
    } catch (error) {
      throw new InternalServerErrorException(`S3 upload failed: ${error.message}`);
    }
  }

  private async saveToLocal(file: Express.Multer.File, workspaceId: string, fileName: string): Promise<{ url: string; fileName: string }> {
    try {
      const targetDir = path.join(process.cwd(), this.localPath, workspaceId);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, fileName);
      await fs.promises.writeFile(filePath, file.buffer);

      const relativeUrl = path.join(this.localPath, workspaceId, fileName).replace(/\\/g, '/');
      return { url: relativeUrl, fileName: file.originalname };
    } catch (error) {
      throw new InternalServerErrorException(`Local upload failed: ${error.message}`);
    }
  }

  async getDownloadUrl(fileUrl: string): Promise<{ url: string } | { stream: fs.ReadStream; mimeType: string }> {
    if (this.driver === 's3') {
      const presignedUrl = await this.generatePresignedUrl(fileUrl);
      return { url: presignedUrl };
    }

    const fullPath = path.join(process.cwd(), fileUrl);
    if (!fs.existsSync(fullPath)) {
      throw new BadRequestException('File does not exist on disk');
    }

    const mimeType = this.getMimeType(fileUrl);
    const stream = fs.createReadStream(fullPath);
    return { stream, mimeType };
  }

  private async generatePresignedUrl(fileUrl: string): Promise<string> {
    try {
      const key = fileUrl.split('.amazonaws.com/')[1] || fileUrl;
      const command = new GetObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.s3Client!, command, { expiresIn: this.s3PresignedExpiry });
      return url;
    } catch (error) {
      throw new InternalServerErrorException(`Generating presigned URL failed: ${error.message}`);
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    if (this.driver === 's3') {
      const key = fileUrl.split('.amazonaws.com/')[1] || fileUrl;
      await this.deleteFromS3(key);
    } else {
      const fullPath = path.join(process.cwd(), fileUrl);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    }
  }

  private async deleteFromS3(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
      });
      await this.s3Client!.send(command);
    } catch (error) {
      throw new InternalServerErrorException(`S3 delete failed: ${error.message}`);
    }
  }
}
