import { createZodDto } from 'nestjs-zod';
import { CreateTransactionSchema } from './create-transaction.dto';

export const UpdateTransactionSchema = CreateTransactionSchema.partial();

export class UpdateTransactionDto extends createZodDto(UpdateTransactionSchema) {}
