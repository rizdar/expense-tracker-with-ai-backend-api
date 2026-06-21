import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiHeader, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceId } from '../common/decorators/workspace-id.decorator';
import { WorkspaceIdPipe } from '../common/pipes/workspace-id.pipe';
import { SkipAudit } from '../common/decorators/skip-audit.decorator';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';
import { Throttle, minutes } from '@nestjs/throttler';

@SkipAudit()
@ApiTags('Categories')
@ApiBearerAuth()
@ApiHeader({
  name: 'x-workspace-id',
  description: 'The active Workspace ID',
  required: true,
})
@UseGuards(JwtAuthGuard)
@Controller('categories')
@Throttle({ default: { limit: 60, ttl: minutes(1) } })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or category already exists' })
  @ApiResponse({ status: 403, description: 'Access denied or insufficient roles' })
  create(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(workspaceId, req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories for workspace' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  findAll(
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Query() query: CategoryQueryDto,
  ) {
    return this.categoriesService.findAll(workspaceId, req.user.id, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category detail' })
  @ApiResponse({ status: 200, description: 'Category retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  findOne(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
  ) {
    return this.categoriesService.findOne(id, workspaceId, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  update(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, workspaceId, req.user.id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a category' })
  @ApiResponse({ status: 200, description: 'Category soft deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete category with active transactions' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  remove(
    @Param('id') id: string,
    @WorkspaceId(WorkspaceIdPipe) workspaceId: string,
    @Req() req: any,
  ) {
    return this.categoriesService.softDelete(id, workspaceId, req.user.id);
  }
}
