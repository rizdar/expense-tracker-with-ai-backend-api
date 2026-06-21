import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleCheckerService } from '../common/services/role-checker.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryQueryDto } from './dto/category-query.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleChecker: RoleCheckerService,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateCategoryDto) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN']);

    const existing = await this.prisma.category.findUnique({
      where: {
        workspaceId_name_type: {
          workspaceId,
          name: dto.name,
          type: dto.type,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('Category already exists');
    }

    const category = await this.prisma.$transaction(async (tx) => {
      const cat = await tx.category.create({
        data: {
          workspaceId,
          name: dto.name,
          type: dto.type,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'CREATE',
          entity: 'Category',
          entityId: cat.id,
          changes: { after: cat },
        },
      });

      return cat;
    });

    return {
      success: true,
      message: 'Category created successfully',
      data: category,
    };
  }

  async findAll(workspaceId: string, userId: string, query: CategoryQueryDto) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    const { page, limit, sortBy, order, type, includeDeleted } = query;
    const skip = (page - 1) * limit;

    const ALLOWED_SORT_COLUMNS = ['name', 'type', 'createdAt', 'updatedAt'];
    const orderColumn = sortBy && ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : 'createdAt';

    const whereClause: any = {
      workspaceId,
      ...(type ? { type } : {}),
      ...(!includeDeleted ? { deletedAt: null } : {}),
    };

    const [total, categories] = await Promise.all([
      this.prisma.category.count({ where: whereClause }),
      this.prisma.category.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [orderColumn]: order },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Categories retrieved successfully',
      data: categories,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  async findOne(id: string, workspaceId: string, userId: string) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    const category = await this.prisma.category.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return {
      success: true,
      message: 'Category retrieved successfully',
      data: category,
    };
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateCategoryDto) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN']);

    const existing = await this.prisma.category.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    if (dto.name || dto.type) {
      const name = dto.name ?? existing.name;
      const type = dto.type ?? existing.type;
      const duplicate = await this.prisma.category.findFirst({
        where: {
          workspaceId,
          name,
          type,
          id: { not: id },
        },
      });
      if (duplicate) {
        throw new BadRequestException('Category already exists');
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const cat = await tx.category.update({
        where: { id },
        data: {
          name: dto.name,
          type: dto.type,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'UPDATE',
          entity: 'Category',
          entityId: cat.id,
          changes: { before: existing, after: cat },
        },
      });

      return cat;
    });

    return {
      success: true,
      message: 'Category updated successfully',
      data: updated,
    };
  }

  async softDelete(id: string, workspaceId: string, userId: string) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN']);

    const existing = await this.prisma.category.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Category not found');
    }

    // Validasi transaksi aktif
    const activeTransactions = await this.prisma.transaction.count({
      where: {
        categoryId: id,
        deletedAt: null,
      },
    });

    if (activeTransactions > 0) {
      throw new BadRequestException('Cannot delete category with active transactions');
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      const cat = await tx.category.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'DELETE',
          entity: 'Category',
          entityId: cat.id,
          changes: { before: existing, after: cat },
        },
      });

      return cat;
    });

    return {
      success: true,
      message: 'Category soft deleted successfully',
      data: deleted,
    };
  }
}
