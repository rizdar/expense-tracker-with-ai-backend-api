import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class WorkspaceIdPipe implements PipeTransform {
  transform(value: any) {
    if (!value) {
      throw new BadRequestException('X-Workspace-Id header is required');
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new BadRequestException('X-Workspace-Id must be a valid UUID');
    }

    return value;
  }
}
