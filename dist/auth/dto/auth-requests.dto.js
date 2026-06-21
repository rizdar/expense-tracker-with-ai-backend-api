"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ForgotPasswordDto = exports.ForgotPasswordSchema = exports.LogoutDto = exports.LogoutSchema = exports.RefreshDto = exports.RefreshSchema = exports.ResendVerificationDto = exports.ResendVerificationSchema = void 0;
const nestjs_zod_1 = require("nestjs-zod");
const zod_1 = require("zod");
exports.ResendVerificationSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
});
class ResendVerificationDto extends (0, nestjs_zod_1.createZodDto)(exports.ResendVerificationSchema) {
}
exports.ResendVerificationDto = ResendVerificationDto;
exports.RefreshSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
class RefreshDto extends (0, nestjs_zod_1.createZodDto)(exports.RefreshSchema) {
}
exports.RefreshDto = RefreshDto;
exports.LogoutSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
class LogoutDto extends (0, nestjs_zod_1.createZodDto)(exports.LogoutSchema) {
}
exports.LogoutDto = LogoutDto;
exports.ForgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email format'),
});
class ForgotPasswordDto extends (0, nestjs_zod_1.createZodDto)(exports.ForgotPasswordSchema) {
}
exports.ForgotPasswordDto = ForgotPasswordDto;
//# sourceMappingURL=auth-requests.dto.js.map