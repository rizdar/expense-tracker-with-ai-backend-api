import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const AuditLogQuerySchema = PaginationSchema.merge(
  z.object({
    entity: z.string().optional(),
    action: z.string().optional(),
    actorId: z.string().uuid().optional(),
  })
);

export class AuditLogQueryDto extends createZodDto(AuditLogQuerySchema) {}
