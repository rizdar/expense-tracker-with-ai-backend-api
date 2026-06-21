import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PaginationSchema } from '../../common/dto/pagination.dto';

export const TransactionQuerySchema = PaginationSchema.merge(
  z.object({
    startDate: z.string().datetime({ message: 'Invalid startDate format' }).optional(),
    endDate: z.string().datetime({ message: 'Invalid endDate format' }).optional(),
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    categoryId: z.string().uuid({ message: 'Invalid categoryId format' }).optional(),
    source: z.enum(['MANUAL', 'AI_CHAT', 'AI_OCR']).optional(),
  })
);

export class TransactionQueryDto extends createZodDto(TransactionQuerySchema) {}
