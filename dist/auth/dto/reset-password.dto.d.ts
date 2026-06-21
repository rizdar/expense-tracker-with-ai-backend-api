import { z } from 'zod';
export declare const ResetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
declare const ResetPasswordDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    token: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>, false>;
export declare class ResetPasswordDto extends ResetPasswordDto_base {
}
export {};
