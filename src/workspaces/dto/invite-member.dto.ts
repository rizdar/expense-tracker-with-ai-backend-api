import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const InviteMemberSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  role: z.enum(['ADMIN', 'VIEWER']),
});

export class InviteMemberDto extends createZodDto(InviteMemberSchema) {}
