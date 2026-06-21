import { Test, TestingModule } from '@nestjs/testing';
import { WorkspacesController } from './workspaces.controller';
import { WorkspacesService } from './workspaces.service';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

describe('WorkspacesController', () => {
  let controller: WorkspacesController;

  const mockWorkspacesService = {
    getWorkspaces: jest.fn().mockResolvedValue({ success: true, data: [], meta: {} }),
    createWorkspace: jest.fn().mockResolvedValue({ success: true, data: {} }),
    getWorkspaceById: jest.fn().mockResolvedValue({ success: true, data: {} }),
    updateWorkspace: jest.fn().mockResolvedValue({ success: true, data: {} }),
    softDeleteWorkspace: jest.fn().mockResolvedValue({ success: true }),
    restoreWorkspace: jest.fn().mockResolvedValue({ success: true }),
    transferOwnership: jest.fn().mockResolvedValue({ success: true }),
    getMembers: jest.fn().mockResolvedValue({ success: true, data: [] }),
    updateMemberRole: jest.fn().mockResolvedValue({ success: true }),
    kickMember: jest.fn().mockResolvedValue({ success: true }),
    inviteMember: jest.fn().mockResolvedValue({ success: true, data: {} }),
    getInvitationInfo: jest.fn().mockResolvedValue({ success: true, data: {} }),
    acceptInvitation: jest.fn().mockResolvedValue({ success: true }),
  };

  const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkspacesController],
      providers: [
        { provide: WorkspacesService, useValue: mockWorkspacesService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(WorkspaceRoleGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<WorkspacesController>(WorkspacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
