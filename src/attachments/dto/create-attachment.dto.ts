import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateAttachmentSchema = z.object({
  transactionId: z.string().uuid({ message: 'Invalid transactionId format' }),
});

export class CreateAttachmentDto extends createZodDto(CreateAttachmentSchema) {}
