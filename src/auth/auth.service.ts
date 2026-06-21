import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { FcmService } from '../fcm/fcm.service';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly fcmService: FcmService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
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

    // Simulate sending verification email by printing it to logger
    this.logger.log(`[EMAIL SIMULATION] Verification token for ${newUser.email}: ${emailVerifyToken}`);
    
    return {
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
    };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: dto.token },
    });

    if (!user) {
      throw new BadRequestException('Verification token is invalid or has expired');
    }

    // Perform transaction to create default workspace and categories
    await this.prisma.$transaction(async (tx) => {
      // 1. Update user emailVerified status
      await tx.user.update({
        where: { id: user.id },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
        },
      });

      // 2. Create default personal workspace
      const workspace = await tx.workspace.create({
        data: {
          name: 'Personal Workspace',
          type: 'PERSONAL',
          currency: 'IDR',
          timezone: 'UTC',
        },
      });

      // 3. Link user to workspace as OWNER
      await tx.workspaceMember.create({
        data: {
          userId: user.id,
          workspaceId: workspace.id,
          role: 'OWNER',
        },
      });

      // 4. Initialize default financial categories
      const defaultCategories = [
        // EXPENSE
        { name: 'Food & Beverage', type: 'EXPENSE' },
        { name: 'Transportation', type: 'EXPENSE' },
        { name: 'Shopping', type: 'EXPENSE' },
        { name: 'Bills & Utilities', type: 'EXPENSE' },
        { name: 'Entertainment', type: 'EXPENSE' },
        { name: 'Health', type: 'EXPENSE' },
        // INCOME
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

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    const emailVerifyToken = crypto.randomBytes(32).toString('hex');
    await this.usersService.updateUser(user.id, { emailVerifyToken });

    // Simulate resend email
    this.logger.log(`[EMAIL SIMULATION] New verification token for ${user.email}: ${emailVerifyToken}`);

    return {
      success: true,
      message: 'New verification email sent successfully.',
    };
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Incorrect email or password');
    }

    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Your email has not been verified. Please verify your email first.',
      );
    }

    const tokens = await this.generateTokenPair(user);

    // Write LOGIN Audit Log
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

  async refresh(inputRefreshToken: string) {
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
      throw new UnauthorizedException('Refresh token is invalid or has expired');
      }

      const isMatch = await bcrypt.compare(inputRefreshToken, record.tokenHash);
      if (!isMatch) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Prepare payload for Access Token Rotation
      await this.prisma.refreshToken.update({
        where: { id: jti },
        data: { revoked: true },
      });

      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const newTokens = await this.generateTokenPair(user);

      return {
        success: true,
        data: newTokens,
      };
    } catch (err) {
      throw new UnauthorizedException('Refresh token is invalid or has expired');
    }
  }

  async logout(inputRefreshToken: string) {
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

      // Write LOGOUT Audit Log
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
    } catch (err) {
      // Still return success for privacy and frontend flow
      return {
        success: true,
        message: 'Logout successful.',
      };
    }
  }

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);
    // Return fake success message for security (user enumeration prevention)
    if (!user) {
      return {
        success: true,
        message: 'Password reset instructions have been sent to your email if registered.',
      };
    }

    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

    await this.usersService.updateUser(user.id, {
      passwordResetToken,
      passwordResetExpiry,
    });

    // Simulate reset password email
    this.logger.log(`[EMAIL SIMULATION] Password reset token for ${user.email}: ${passwordResetToken}`);

    return {
      success: true,
      message: 'Password reset instructions have been sent to your email if registered.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: dto.token,
        passwordResetExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Reset password token is invalid or has expired');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.usersService.updateUser(user.id, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    });

    // Send push notification
    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: { userId: user.id },
    });

    if (deviceTokens.length > 0) {
      await this.fcmService.sendToUser(user.id, deviceTokens.map((d) => d.token), {
        title: 'Password Changed',
        body: 'Your password has been successfully reset. If this wasn\'t you, please contact support.',
        data: { type: 'PASSWORD_RESET' },
      });
    }

    return {
      success: true,
      message: 'Your password has been reset successfully.',
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestException('Incorrect old password');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.usersService.updateUser(user.id, {
      passwordHash,
    });

    // Write PASSWORD_CHANGED Audit Log
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

  // Generate new token pair
  private async generateTokenPair(user: User) {
    const accessTokenPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(accessTokenPayload, {
      secret: process.env.JWT_SECRET || 'super-secret-jwt-key-2026',
      expiresIn: (process.env.JWT_EXPIRY || '24h') as any,
    });

    // Create RefreshToken record in DB first
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const dbRefreshToken = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: '',
        expiresAt,
      },
    });

    // Sign refresh token using record ID as jti
    const refreshTokenPayload = {
      sub: user.id,
      email: user.email,
      jti: dbRefreshToken.id,
    };
    const refreshToken = await this.jwtService.signAsync(refreshTokenPayload, {
      secret: process.env.JWT_REFRESH_SECRET || 'super-secret-refresh-jwt-key-2026',
      expiresIn: (process.env.JWT_REFRESH_EXPIRY || '7d') as any,
    });

    // Update refresh token in database
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
}
