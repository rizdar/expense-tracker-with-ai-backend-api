import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const PermanentDeleteTransactionSchema = z.object({
  reason: z.string().trim().min(1, 'Reason for permanent deletion is required'),
});

export class PermanentDeleteTransactionDto extends createZodDto(PermanentDeleteTransactionSchema) {}
