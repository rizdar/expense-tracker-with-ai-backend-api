import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class FileValidationPipe implements PipeTransform {
  readonly MAX_SIZE = 10 * 1024 * 1024; // 10MB
  readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'application/pdf',
  ];

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (file.size > this.MAX_SIZE) {
      throw new BadRequestException('File size exceeds the 10MB limit');
    }

    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`
      );
    }

    return file;
  }
}
