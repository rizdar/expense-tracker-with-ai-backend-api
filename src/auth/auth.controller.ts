import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  ResendVerificationDto,
  RefreshDto,
  LogoutDto,
  ForgotPasswordDto,
} from './dto/auth-requests.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { Throttle, minutes, hours } from '@nestjs/throttler';

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: minutes(1) } })
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  @Post('register')
  @ApiOperation({ summary: 'Register new user' })
  @ApiBody({
    type: RegisterDto,
    examples: {
      default: {
        summary: 'Example Registration Payload',
        value: {
          email: 'user@example.com',
          password: 'PasswordSuper123',
          name: 'Test User',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Registration successful. Verification token sent.' })
  @ApiResponse({ status: 400, description: 'Validation failed.' })
  @ApiResponse({ status: 409, description: 'Email already registered.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email' })
  @ApiBody({
    type: VerifyEmailDto,
    examples: {
      default: {
        summary: 'Example Verify Email Payload',
        value: {
          token: '558934b6419177a9d0583e201a42c2bd0bd482d8ce224a1eb134d6559587a275',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Email verified successfully. Default workspace created.' })
  @ApiResponse({ status: 400, description: 'Invalid token.' })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Throttle({ default: { limit: 3, ttl: hours(1) } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend verification email' })
  @ApiBody({
    type: ResendVerificationDto,
    examples: {
      default: {
        summary: 'Example Resend Verification Payload',
        value: {
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'New verification email sent successfully.' })
  @ApiResponse({ status: 404, description: 'User not found.' })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user to get tokens' })
  @ApiBody({
    type: LoginDto,
    examples: {
      default: {
        summary: 'Example Login Payload',
        value: {
          email: 'user@example.com',
          password: 'PasswordSuper123',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Login successful, returns token.' })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  @ApiResponse({ status: 403, description: 'Email not verified.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate access token using refresh token' })
  @ApiBody({
    type: RefreshDto,
    examples: {
      default: {
        summary: 'Example Refresh Token Payload',
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0...',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Token rotation successful.' })
  @ApiResponse({ status: 401, description: 'Refresh token expired or invalid.' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Logout user (revoke refresh token)' })
  @ApiBody({
    type: LogoutDto,
    examples: {
      default: {
        summary: 'Example Logout Payload',
        value: {
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWlkIiwiZW1haWwiOiJ1c2VyQGV4YW1wbGUuY29tIn0...',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logout successful.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request forgot password (send reset link/token)' })
  @ApiBody({
    type: ForgotPasswordDto,
    examples: {
      default: {
        summary: 'Example Forgot Password Payload',
        value: {
          email: 'user@example.com',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Reset password instructions sent.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using reset token' })
  @ApiBody({
    type: ResetPasswordDto,
    examples: {
      default: {
        summary: 'Example Reset Password Payload',
        value: {
          token: '421195d894652a4ebe3bcc2c3bb00de9dcb7043dc001e8716c8f154a2e763f05',
          newPassword: 'NewPasswordBaru123',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token.' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Patch('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Change account password (logged in user)' })
  @ApiBody({
    type: ChangePasswordDto,
    examples: {
      default: {
        summary: 'Example Change Password Payload',
        value: {
          oldPassword: 'PasswordSuper123',
          newPassword: 'NewPasswordBaru123',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password changed successfully.' })
  @ApiResponse({ status: 400, description: 'Incorrect old password or invalid input.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = req.user.id;
    return this.authService.changePassword(userId, dto);
  }
}
