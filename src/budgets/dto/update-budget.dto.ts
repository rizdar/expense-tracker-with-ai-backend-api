import { createZodDto } from 'nestjs-zod';
import { CreateBudgetBaseSchema } from './create-budget.dto';

export const UpdateBudgetSchema = CreateBudgetBaseSchema.partial().refine(data => {
  if (data.period === 'CUSTOM') {
    return !!data.startDate && !!data.endDate;
  }
  return true;
}, {
  message: 'startDate and endDate are required when period is CUSTOM',
  path: ['startDate'],
});

export class UpdateBudgetDto extends createZodDto(UpdateBudgetSchema) {}
