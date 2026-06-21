import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { FcmService } from '../fcm/fcm.service';

describe('AuthService', () => {
  let service: AuthService;

  const mockPrisma = { user: { findUnique: jest.fn(), findFirst: jest.fn() }, deviceToken: { findMany: jest.fn() }, $transaction: jest.fn(), refreshToken: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() } };
  const mockUsersService = { findByEmail: jest.fn(), create: jest.fn(), findById: jest.fn(), updateUser: jest.fn() };
  const mockJwtService = { sign: jest.fn(), verify: jest.fn() };
  const mockFcmService = { sendToUser: jest.fn(), sendToWorkspaceMembers: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: FcmService, useValue: mockFcmService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
