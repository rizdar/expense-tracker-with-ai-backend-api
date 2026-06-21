import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesService } from './workspaces.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkspacesService', () => {
  let service: WorkspacesService;

  const prismaMock = {
    workspace: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), count: jest.fn() },
    workspaceMember: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    workspaceInvitation: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    category: { createMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };

  const mockPrismaService = {
    ...prismaMock,
    $transaction: jest.fn().mockImplementation((fnOrArray: any) => {
      if (typeof fnOrArray === 'function') {
        return fnOrArray(mockPrismaService);
      }
      return Promise.resolve([]);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspacesService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkspacesService>(WorkspacesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
