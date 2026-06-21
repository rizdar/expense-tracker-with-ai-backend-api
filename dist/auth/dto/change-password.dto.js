"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChangePasswordDto = exports.ChangePasswordSchema = void 0;
const nestjs_zod_1 = require("nestjs-zod");
const zod_1 = require("zod");
exports.ChangePasswordSchema = zod_1.z.object({
    oldPassword: zod_1.z.string().min(1, 'Old password is required'),
    newPassword: zod_1.z.string().min(8, 'New password must be at least 8 characters'),
});
class ChangePasswordDto extends (0, nestjs_zod_1.createZodDto)(exports.ChangePasswordSchema) {
}
exports.ChangePasswordDto = ChangePasswordDto;
//# sourceMappingURL=change-password.dto.js.map