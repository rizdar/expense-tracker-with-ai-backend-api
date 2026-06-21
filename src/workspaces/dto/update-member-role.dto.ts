import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'VIEWER']),
});

export class UpdateMemberRoleDto extends createZodDto(UpdateMemberRoleSchema) {}
