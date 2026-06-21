import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateBudgetBaseSchema = z.object({
  name: z.string().min(1).max(255),
  categoryId: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  period: z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM']),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
});

export const CreateBudgetSchema = CreateBudgetBaseSchema.refine(data => {
  if (data.period === 'CUSTOM') {
    return !!data.startDate && !!data.endDate;
  }
  return true;
}, {
  message: 'startDate and endDate are required when period is CUSTOM',
  path: ['startDate'],
});

export class CreateBudgetDto extends createZodDto(CreateBudgetSchema) {}

