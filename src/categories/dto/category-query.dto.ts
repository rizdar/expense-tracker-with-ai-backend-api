import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const CategoryQuerySchema = PaginationSchema.merge(
  z.object({
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
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

export class CategoryQueryDto extends createZodDto(CategoryQuerySchema) {}
