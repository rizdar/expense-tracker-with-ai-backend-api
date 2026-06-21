import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const BudgetQuerySchema = PaginationSchema.merge(
  z.object({
    period: z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM']).optional(),
    categoryId: z.string().uuid().optional(),
    includeDeleted: z.preprocess(
      (val) => {
        if (val === 'true') return true;
        if (val === 'false') return false;
        return undefined;
      },
      z.boolean().optional()
    ),
  })
);

export class BudgetQueryDto extends createZodDto(BudgetQuerySchema) {}
