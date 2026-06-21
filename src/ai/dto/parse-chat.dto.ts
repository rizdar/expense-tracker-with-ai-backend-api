import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ParseChatSchema = z.object({
  text: z.string().min(3).max(1000, { message: 'Text input must be between 3 and 1000 characters' }),
});

export class ParseChatDto extends createZodDto(ParseChatSchema) {}
