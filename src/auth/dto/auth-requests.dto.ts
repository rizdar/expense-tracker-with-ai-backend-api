import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const ResendVerificationSchema = z.object({
  email: z.string().email('Invalid email format'),
});
export class ResendVerificationDto extends createZodDto(
  ResendVerificationSchema,
) {}

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export class RefreshDto extends createZodDto(RefreshSchema) {}

export const LogoutSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export class LogoutDto extends createZodDto(LogoutSchema) {}

export const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email format'),
});
export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
