import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const WorkspaceId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    const headerValue = request.headers['x-workspace-id'];
    return Array.isArray(headerValue) ? headerValue[0] : headerValue || '';
  },
);
