import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required'),
  type: z.enum(['INCOME', 'EXPENSE'], {
    message: 'Category type must be INCOME or EXPENSE',
  }),
});

export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}
