"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyEmailDto = exports.VerifyEmailSchema = void 0;
const nestjs_zod_1 = require("nestjs-zod");
const zod_1 = require("zod");
exports.VerifyEmailSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Token verifikasi wajib diisi'),
});
class VerifyEmailDto extends (0, nestjs_zod_1.createZodDto)(exports.VerifyEmailSchema) {
}
exports.VerifyEmailDto = VerifyEmailDto;
//# sourceMappingURL=verify-email.dto.js.map