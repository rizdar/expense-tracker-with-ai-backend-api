import { z } from 'zod';
export declare const ResendVerificationSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
declare const ResendVerificationDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>, false>;
export declare class ResendVerificationDto extends ResendVerificationDto_base {
}
export declare const RefreshSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>;
declare const RefreshDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>, false>;
export declare class RefreshDto extends RefreshDto_base {
}
export declare const LogoutSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>;
declare const LogoutDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>, false>;
export declare class LogoutDto extends LogoutDto_base {
}
export declare const ForgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
declare const ForgotPasswordDto_base: import("nestjs-zod").ZodDto<z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>, false>;
export declare class ForgotPasswordDto extends ForgotPasswordDto_base {
}
export {};
