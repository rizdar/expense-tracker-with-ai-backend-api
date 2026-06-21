import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const InsightsQuerySchema = z.object({
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO 8601 datetime string' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO 8601 datetime string' }).optional(),
});

export class InsightsQueryDto extends createZodDto(InsightsQuerySchema) {}
