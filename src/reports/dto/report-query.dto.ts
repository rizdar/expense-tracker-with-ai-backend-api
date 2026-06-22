import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ReportQuerySchema = z.object({
  startDate: z.string().datetime({ message: 'Invalid startDate ISO format' }).optional(),
  endDate: z.string().datetime({ message: 'Invalid endDate ISO format' }).optional(),
  format: z.enum(['csv', 'pdf']).optional(),
});

export class ReportQueryDto extends createZodDto(ReportQuerySchema) {}
