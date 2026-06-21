import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const RegisterDeviceSchema = z.object({
  token: z.string().min(1, { message: 'FCM token is required' }),
  platform: z.enum(['ios', 'android'], { message: 'Platform must be ios or android' }),
});

export class RegisterDeviceDto extends createZodDto(RegisterDeviceSchema) {}
