import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const TransferOwnershipSchema = z.object({
  newOwnerId: z.string().uuid('newOwnerId must be a valid UUID'),
});

export class TransferOwnershipDto extends createZodDto(TransferOwnershipSchema) {}
