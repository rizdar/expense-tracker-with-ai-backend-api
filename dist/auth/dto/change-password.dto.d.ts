import { z } from 'zod';
export declare const ChangePasswordSchema: z.ZodObject<{
    oldPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>;
declare const ChangePasswordDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    oldPassword: z.ZodString;
    newPassword: z.ZodString;
}, z.core.$strip>, false>;
export declare class ChangePasswordDto extends ChangePasswordDto_base {
}
export {};
