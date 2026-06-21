import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(workspaceId: string, userId: string, dto: CreateBudgetDto) {
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          workspaceId,
          deletedAt: null,
        },
      });
      if (!category) {
        throw new BadRequestException('Category not found in this workspace');
      }
    }

    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (dto.period === 'CUSTOM') {
      startDate = new Date(dto.startDate!);
      endDate = new Date(dto.endDate!);
    } else if (dto.startDate && dto.endDate) {
      startDate = new Date(dto.startDate);
      endDate = new Date(dto.endDate);
    }

    const budget = await this.prisma.$transaction(async (tx) => {
      const created = await tx.budget.create({
        data: {
          workspaceId,
          categoryId: dto.categoryId || null,
          name: dto.name,
          amount: dto.amount,
          period: dto.period,
          startDate,
          endDate,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'CREATE',
          entity: 'Budget',
          entityId: created.id,
          changes: { after: created },
        },
      });

      return created;
    });

    return {
      success: true,
      message: 'Budget created successfully',
      data: budget,
    };
  }

  async findAll(workspaceId: string, query: BudgetQueryDto) {
    const { page = 1, limit = 20, sortBy = 'createdAt', order = 'desc', period, categoryId, includeDeleted = false } = query;

    const ALLOWED_SORT_COLUMNS = ['name', 'amount', 'period', 'createdAt', 'updatedAt'];
    const orderColumn = sortBy && ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : 'createdAt';

    const where: any = { workspaceId };

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (period) where.period = period;
    if (categoryId) where.categoryId = categoryId;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.budget.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderColumn]: order },
        include: {
          category: { select: { id: true, name: true, type: true } },
        },
      }),
      this.prisma.budget.count({ where }),
    ]);

    return {
      success: true,
      message: 'Budgets retrieved successfully',
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, workspaceId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, workspaceId, deletedAt: null },
      include: {
        category: { select: { id: true, name: true, type: true } },
      },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    return {
      success: true,
      message: 'Budget retrieved successfully',
      data: budget,
    };
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateBudgetDto) {
    const existing = await this.prisma.budget.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Budget not found');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, workspaceId, deletedAt: null },
      });
      if (!category) {
        throw new BadRequestException('Category not found in this workspace');
      }
    }

    const updatedPeriod = dto.period || existing.period;
    let startDate: Date | null = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    let endDate: Date | null = dto.endDate ? new Date(dto.endDate) : existing.endDate;

    if (updatedPeriod === 'CUSTOM') {
      if (!startDate || !endDate) {
        throw new BadRequestException('startDate and endDate are required for CUSTOM period');
      }
    } else if (dto.period && dto.period !== 'CUSTOM') {
      if (!dto.startDate) startDate = null;
      if (!dto.endDate) endDate = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.budget.update({
        where: { id },
        data: {
          categoryId: dto.categoryId === undefined ? existing.categoryId : dto.categoryId,
          name: dto.name || existing.name,
          amount: dto.amount || existing.amount,
          period: updatedPeriod,
          startDate,
          endDate,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'UPDATE',
          entity: 'Budget',
          entityId: id,
          changes: { before: existing, after: result },
        },
      });

      return result;
    });

    return {
      success: true,
      message: 'Budget updated successfully',
      data: updated,
    };
  }

  async softDelete(id: string, workspaceId: string, userId: string) {
    const existing = await this.prisma.budget.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!existing) {
      throw new NotFoundException('Budget not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.budget.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'DELETE',
          entity: 'Budget',
          entityId: id,
          changes: { before: existing },
        },
      });
    });

    return {
      success: true,
      message: 'Budget soft-deleted successfully',
    };
  }

  async getBudgetStatus(id: string, workspaceId: string) {
    const budget = await this.prisma.budget.findFirst({
      where: { id, workspaceId, deletedAt: null },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const { startDate, endDate } = this.calculateBudgetPeriodDates(
      budget.period,
      budget.startDate,
      budget.endDate,
    );

    const where: any = {
      workspaceId,
      date: { gte: startDate, lte: endDate },
      deletedAt: null,
      type: 'EXPENSE',
    };

    if (budget.categoryId) {
      where.categoryId = budget.categoryId;
    }

    const aggregate = await this.prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
    });

    const spent = Number(aggregate._sum.amount || 0);
    const limitAmount = Number(budget.amount);
    const percentage = limitAmount > 0 ? (spent / limitAmount) * 100 : 0;

    let status = 'ON_TRACK';
    if (percentage >= 100) {
      status = 'OVER_BUDGET';
    } else if (percentage >= 80) {
      status = 'WARNING';
    }

    return {
      success: true,
      message: 'Budget status retrieved successfully',
      data: {
        id: budget.id,
        name: budget.name,
        amount: limitAmount,
        spent,
        percentage,
        status,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    };
  }

  calculateBudgetPeriodDates(
    period: string,
    budgetStartDate: Date | null,
    budgetEndDate: Date | null,
  ): { startDate: Date; endDate: Date } {
    if (period === 'CUSTOM') {
      return {
        startDate: budgetStartDate || new Date(),
        endDate: budgetEndDate || new Date(),
      };
    }

    if (period === 'WEEKLY') {
      return this.getWeekRange();
    }

    // MONTHLY (default)
    return this.getMonthRange();
  }

  private getWeekRange(): { startDate: Date; endDate: Date } {
    const now = new Date();
    const day = now.getUTCDay();
    // Monday = 1, Sunday = 0 → diff: Sunday = 6 days back, Monday = 0, Tuesday = 1, ...
    const diffToMonday = day === 0 ? 6 : day - 1;

    const start = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - diffToMonday,
      0, 0, 0, 0,
    ));

    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    end.setUTCHours(23, 59, 59, 999);

    return { startDate: start, endDate: end };
  }

  private getMonthRange(): { startDate: Date; endDate: Date } {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { startDate: start, endDate: end };
  }
}
