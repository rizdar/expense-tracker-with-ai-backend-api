import { z } from 'zod';
export declare const RegisterSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>;
declare const RegisterDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
}, z.core.$strip>, false>;
export declare class RegisterDto extends RegisterDto_base {
}
export {};
