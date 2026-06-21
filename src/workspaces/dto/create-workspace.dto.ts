import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateWorkspaceSchema = z.object({
  name: z.string().min(3, 'Workspace name must be at least 3 characters long'),
  type: z.enum(['PERSONAL', 'UMKM', 'ORGANIZATION']),
  currency: z.string().length(3, 'Currency must be a 3-character ISO code').optional().default('IDR'),
  timezone: z.string().optional().default('UTC'),
});

export class CreateWorkspaceDto extends createZodDto(CreateWorkspaceSchema) {}
