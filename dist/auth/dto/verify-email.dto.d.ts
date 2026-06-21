import { z } from 'zod';
export declare const VerifyEmailSchema: z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>;
declare const VerifyEmailDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    token: z.ZodString;
}, z.core.$strip>, false>;
export declare class VerifyEmailDto extends VerifyEmailDto_base {
}
export {};
