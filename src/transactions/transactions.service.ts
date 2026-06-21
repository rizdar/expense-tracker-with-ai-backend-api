import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleCheckerService } from '../common/services/role-checker.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { PermanentDeleteTransactionDto } from './dto/permanent-delete-transaction.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleChecker: RoleCheckerService,
  ) {}

  async create(workspaceId: string, userId: string, dto: CreateTransactionDto) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    // Validasi categoryId
    const category = await this.prisma.category.findFirst({
      where: {
        id: dto.categoryId,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!category) {
      throw new BadRequestException('Invalid category for this workspace');
    }

    if (category.type !== dto.type) {
      throw new BadRequestException(
        `Category type (${category.type}) does not match transaction type (${dto.type})`,
      );
    }

    const transaction = await this.prisma.$transaction(async (tx) => {
      const transactionData = await tx.transaction.create({
        data: {
          workspaceId,
          categoryId: dto.categoryId,
          amount: new Prisma.Decimal(dto.amount),
          type: dto.type,
          notes: dto.notes,
          date: dto.date ? new Date(dto.date) : new Date(),
          source: dto.source ?? 'MANUAL',
        },
        include: {
          category: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'CREATE',
          entity: 'Transaction',
          entityId: transactionData.id,
          changes: { after: transactionData },
        },
      });

      return transactionData;
    });

    return {
      success: true,
      message: 'Transaction created successfully',
      data: transaction,
    };
  }

  async findAll(workspaceId: string, userId: string, query: TransactionQueryDto) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    const { page, limit, sortBy, order, startDate, endDate, type, categoryId, source } = query;
    const skip = (page - 1) * limit;

    const ALLOWED_SORT_COLUMNS = ['date', 'amount', 'type', 'createdAt'];
    const orderColumn = sortBy && ALLOWED_SORT_COLUMNS.includes(sortBy) ? sortBy : 'date';

    const whereClause: any = {
      workspaceId,
      deletedAt: null,
      ...(type ? { type } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(source ? { source } : {}),
      ...(startDate || endDate
        ? {
            date: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate ? { lte: new Date(endDate) } : {}),
            },
          }
        : {}),
    };

    const [workspace, total, transactions] = await Promise.all([
      this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { currency: true },
      }),
      this.prisma.transaction.count({ where: whereClause }),
      this.prisma.transaction.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { [orderColumn]: order },
        include: {
          category: true,
        },
      }),
    ]);

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      message: 'Transactions retrieved successfully',
      data: transactions,
      meta: {
        page,
        limit,
        total,
        totalPages,
      },
      currency: workspace.currency,
    };
  }

  async findOne(id: string, workspaceId: string, userId: string) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    const transaction = await this.prisma.transaction.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: {
        category: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return {
      success: true,
      message: 'Transaction retrieved successfully',
      data: transaction,
    };
  }

  async update(id: string, workspaceId: string, userId: string, dto: UpdateTransactionDto) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN']);

    const existing = await this.prisma.transaction.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
      include: {
        category: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    // Validasi categoryId jika diubah
    if (dto.categoryId && dto.categoryId !== existing.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: {
          id: dto.categoryId,
          workspaceId,
          deletedAt: null,
        },
      });
      if (!category) {
        throw new BadRequestException('Invalid category for this workspace');
      }
      const effectiveType = dto.type ?? existing.type;
      if (category.type !== effectiveType) {
        throw new BadRequestException(
          `Category type (${category.type}) does not match transaction type (${effectiveType})`,
        );
      }
    } else if (dto.type && dto.type !== existing.type) {
      const currentCategory = await this.prisma.category.findFirst({
        where: { id: existing.categoryId, workspaceId, deletedAt: null },
      });
      if (currentCategory && currentCategory.type !== dto.type) {
        throw new BadRequestException(
          `Category type (${currentCategory.type}) does not match transaction type (${dto.type})`,
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const transactionData = await tx.transaction.update({
        where: { id },
        data: {
          categoryId: dto.categoryId,
          amount: dto.amount ? new Prisma.Decimal(dto.amount) : undefined,
          type: dto.type,
          notes: dto.notes,
          date: dto.date ? new Date(dto.date) : undefined,
          source: dto.source,
        },
        include: {
          category: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'UPDATE',
          entity: 'Transaction',
          entityId: transactionData.id,
          changes: { before: existing, after: transactionData },
        },
      });

      return transactionData;
    });

    return {
      success: true,
      message: 'Transaction updated successfully',
      data: updated,
    };
  }

  async softDelete(id: string, workspaceId: string, userId: string) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN']);

    const existing = await this.prisma.transaction.findFirst({
      where: {
        id,
        workspaceId,
        deletedAt: null,
      },
    });

    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      const transactionData = await tx.transaction.update({
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
          entity: 'Transaction',
          entityId: transactionData.id,
          changes: { before: existing, after: transactionData },
        },
      });

      return transactionData;
    });

    return {
      success: true,
      message: 'Transaction soft deleted successfully',
      data: deleted,
    };
  }

  async permanentDelete(id: string, workspaceId: string, userId: string, dto: PermanentDeleteTransactionDto) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER']);

    const existing = await this.prisma.transaction.findFirst({
      where: {
        id,
        workspaceId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.transaction.delete({
        where: { id },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          workspaceId,
          action: 'PERMANENT_DELETE',
          entity: 'Transaction',
          entityId: id,
          changes: {
            reason: dto.reason,
            deletedData: existing,
          },
        },
      });
    });

    return {
      success: true,
      message: 'Transaction permanently deleted',
    };
  }
}
