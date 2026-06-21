"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AuthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const users_service_1 = require("../users/users.service");
const jwt_1 = require("@nestjs/jwt");
const bcrypt = __importStar(require("bcrypt"));
const crypto = __importStar(require("crypto"));
let AuthService = AuthService_1 = class AuthService {
    prisma;
    usersService;
    jwtService;
    logger = new common_1.Logger(AuthService_1.name);
    constructor(prisma, usersService, jwtService) {
        this.prisma = prisma;
        this.usersService = usersService;
        this.jwtService = jwtService;
    }
    async register(dto) {
        const existingUser = await this.usersService.findByEmail(dto.email);
        if (existingUser) {
            throw new common_1.ConflictException('Email already registered');
        }
        const passwordHash = await bcrypt.hash(dto.password, 10);
        const emailVerifyToken = crypto.randomBytes(32).toString('hex');
        const newUser = await this.usersService.createUser({
            email: dto.email,
            passwordHash,
            name: dto.name,
            emailVerifyToken,
            emailVerified: false,
        });
        this.logger.log(`[EMAIL SIMULATION] Verification token for ${newUser.email}: ${emailVerifyToken}`);
        return {
            success: true,
            message: 'Registration successful. Please check your email to verify your account.',
        };
    }
    async verifyEmail(dto) {
        const user = await this.prisma.user.findFirst({
            where: { emailVerifyToken: dto.token },
        });
        if (!user) {
            throw new common_1.BadRequestException('Verification token is invalid or has expired');
        }
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: {
                    emailVerified: true,
                    emailVerifyToken: null,
                },
            });
            const workspace = await tx.workspace.create({
                data: {
                    name: 'Personal Workspace',
                    type: 'PERSONAL',
                    currency: 'IDR',
                    timezone: 'UTC',
                },
            });
            await tx.workspaceMember.create({
                data: {
                    userId: user.id,
                    workspaceId: workspace.id,
                    role: 'OWNER',
                },
            });
            const defaultCategories = [
                { name: 'Food & Beverage', type: 'EXPENSE' },
                { name: 'Transportation', type: 'EXPENSE' },
                { name: 'Shopping', type: 'EXPENSE' },
                { name: 'Bills & Utilities', type: 'EXPENSE' },
                { name: 'Entertainment', type: 'EXPENSE' },
                { name: 'Health', type: 'EXPENSE' },
                { name: 'Salary', type: 'INCOME' },
                { name: 'Investment', type: 'INCOME' },
                { name: 'Freelance', type: 'INCOME' },
                { name: 'Bonus', type: 'INCOME' },
                { name: 'Other', type: 'INCOME' },
            ];
            await tx.category.createMany({
                data: defaultCategories.map((cat) => ({
                    workspaceId: workspace.id,
                    name: cat.name,
                    type: cat.type,
                })),
            });
        });
        return {
            success: true,
            message: 'Email verified successfully. Your personal workspace has been created automatically.',
        };
    }
    async resendVerification(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        if (user.emailVerified) {
            throw new common_1.BadRequestException('Email already verified');
        }
        const emailVerifyToken = crypto.randomBytes(32).toString('hex');
        await this.usersService.updateUser(user.id, { emailVerifyToken });
        this.logger.log(`[EMAIL SIMULATION] New verification token for ${user.email}: ${emailVerifyToken}`);
        return {
            success: true,
            message: 'New verification email sent successfully.',
        };
    }
    async login(dto) {
        const user = await this.usersService.findByEmail(dto.email);
        if (!user) {
            throw new common_1.UnauthorizedException('Incorrect email or password');
        }
        const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
        if (!isMatch) {
            throw new common_1.UnauthorizedException('Incorrect email or password');
        }
        if (!user.emailVerified) {
            throw new common_1.ForbiddenException('Your email has not been verified. Please verify your email first.');
        }
        const tokens = await this.generateTokenPair(user);
        await this.prisma.auditLog.create({
            data: {
                actorId: user.id,
                action: 'LOGIN',
                entity: 'User',
                entityId: user.id,
            },
        });
        return {
            success: true,
            data: tokens,
        };
    }
    async refresh(inputRefreshToken) {
        try {
            const payload = await this.jwtService.verifyAsync(inputRefreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-jwt-key-2026',
            });
            const jti = payload.jti;
            const userId = payload.sub;
            const record = await this.prisma.refreshToken.findUnique({
                where: { id: jti },
            });
            if (!record || record.revoked || record.expiresAt < new Date()) {
                throw new common_1.UnauthorizedException('Refresh token is invalid or has expired');
            }
            const isMatch = await bcrypt.compare(inputRefreshToken, record.tokenHash);
            if (!isMatch) {
                throw new common_1.UnauthorizedException('Invalid refresh token');
            }
            await this.prisma.refreshToken.update({
                where: { id: jti },
                data: { revoked: true },
            });
            const user = await this.usersService.findById(userId);
            if (!user) {
                throw new common_1.UnauthorizedException('User not found');
            }
            const newTokens = await this.generateTokenPair(user);
            return {
                success: true,
                data: newTokens,
            };
        }
        catch (err) {
            throw new common_1.UnauthorizedException('Refresh token is invalid or has expired');
        }
    }
    async logout(inputRefreshToken) {
        try {
            const payload = await this.jwtService.verifyAsync(inputRefreshToken, {
                secret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-jwt-key-2026',
            });
            const jti = payload.jti;
            const userId = payload.sub;
            await this.prisma.refreshToken.update({
                where: { id: jti },
                data: { revoked: true },
            });
            await this.prisma.auditLog.create({
                data: {
                    actorId: userId,
                    action: 'LOGOUT',
                    entity: 'User',
                    entityId: userId,
                },
            });
            return {
                success: true,
                message: 'Logout successful.',
            };
        }
        catch (err) {
            return {
                success: true,
                message: 'Logout successful.',
            };
        }
    }
    async forgotPassword(email) {
        const user = await this.usersService.findByEmail(email);
        if (!user) {
            return {
                success: true,
                message: 'Password reset instructions have been sent to your email if registered.',
            };
        }
        const passwordResetToken = crypto.randomBytes(32).toString('hex');
        const passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await this.usersService.updateUser(user.id, {
            passwordResetToken,
            passwordResetExpiry,
        });
        this.logger.log(`[EMAIL SIMULATION] Password reset token for ${user.email}: ${passwordResetToken}`);
        return {
            success: true,
            message: 'Password reset instructions have been sent to your email if registered.',
        };
    }
    async resetPassword(dto) {
        const user = await this.prisma.user.findFirst({
            where: {
                passwordResetToken: dto.token,
                passwordResetExpiry: {
                    gt: new Date(),
                },
            },
        });
        if (!user) {
            throw new common_1.BadRequestException('Reset password token is invalid or has expired');
        }
        const passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.usersService.updateUser(user.id, {
            passwordHash,
            passwordResetToken: null,
            passwordResetExpiry: null,
        });
        return {
            success: true,
            message: 'Your password has been reset successfully.',
        };
    }
    async changePassword(userId, dto) {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new common_1.NotFoundException('User not found');
        }
        const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
        if (!isMatch) {
            throw new common_1.BadRequestException('Incorrect old password');
        }
        const passwordHash = await bcrypt.hash(dto.newPassword, 10);
        await this.usersService.updateUser(user.id, {
            passwordHash,
        });
        await this.prisma.auditLog.create({
            data: {
                actorId: user.id,
                action: 'PASSWORD_CHANGED',
                entity: 'User',
                entityId: user.id,
            },
        });
        return {
            success: true,
            message: 'Your password has been changed successfully.',
        };
    }
    async generateTokenPair(user) {
        const accessTokenPayload = { sub: user.id, email: user.email };
        const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
            secret: process.env.JWT_SECRET || 'super-secret-jwt-key-2026',
            expiresIn: (process.env.JWT_EXPIRY || '24h'),
        });
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        const dbRefreshToken = await this.prisma.refreshToken.create({
            data: {
                userId: user.id,
                tokenHash: '',
                expiresAt,
            },
        });
        const refreshTokenPayload = {
            sub: user.id,
            email: user.email,
            jti: dbRefreshToken.id,
        };
        const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
            secret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-jwt-key-2026',
            expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d'),
        });
        const tokenHash = await bcrypt.hash(refreshToken, 10);
        await this.prisma.refreshToken.update({
            where: { id: dbRefreshToken.id },
            data: { tokenHash },
        });
        return {
            accessToken,
            refreshToken,
        };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = AuthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        users_service_1.UsersService,
        jwt_1.JwtService])
], AuthService);
//# sourceMappingURL=auth.service.js.map