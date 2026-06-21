import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateTransactionSchema = z.object({
  categoryId: z.string().uuid({ message: 'Invalid categoryId format' }),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: 'Amount must be a positive decimal number with up to 2 decimal places',
  }).refine(
    (val) => parseFloat(val) > 0,
    { message: 'Amount must be greater than 0' },
  ),
  type: z.enum(['INCOME', 'EXPENSE'], {
    message: 'Transaction type must be INCOME or EXPENSE',
  }),
  notes: z.string().trim().optional(),
  date: z.string().datetime({ message: 'Invalid ISO date-time format' }).optional(),
  source: z.enum(['MANUAL', 'AI_CHAT', 'AI_OCR']).optional().default('MANUAL'),
});

export class CreateTransactionDto extends createZodDto(CreateTransactionSchema) {}
