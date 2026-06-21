import { createZodDto } from 'nestjs-zod';
import { CreateWorkspaceSchema } from './create-workspace.dto';

export const UpdateWorkspaceSchema = CreateWorkspaceSchema.partial();

export class UpdateWorkspaceDto extends createZodDto(UpdateWorkspaceSchema) {}
