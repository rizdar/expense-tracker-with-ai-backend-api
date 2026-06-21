import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class QuotaService {
  constructor(private readonly prisma: PrismaService) {}

  private getStartOfTodayUTC(): Date {
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    return now;
  }

  async checkAndReserveQuota(
    workspaceId: string,
    userId: string,
    limit: number,
    type: 'CHAT' | 'OCR' | 'INSIGHTS',
    model: string,
  ): Promise<{ allowed: boolean; quotaUsed: number; resetAt: string; usageId?: string }> {
    const todayUTC = this.getStartOfTodayUTC();
    const resetAt = new Date(todayUTC);
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);

    return this.prisma.$transaction(async (tx) => {
      // Row-level lock to prevent concurrent quota allocation
      await tx.$queryRawUnsafe(
        `SELECT id FROM "User" WHERE id = $1 FOR UPDATE`,
        userId,
      );

      const used = await tx.aIPromptUsage.count({
        where: { userId, createdAt: { gte: todayUTC } },
      });

      if (used >= limit) {
        return { allowed: false, quotaUsed: used, resetAt: resetAt.toISOString() };
      }

      // Create a placeholder usage record to reserve quota
      const usage = await tx.aIPromptUsage.create({
        data: {
          workspaceId,
          userId,
          type,
          model,
          tokensUsed: 0,
        },
      });

      return {
        allowed: true,
        quotaUsed: used + 1,
        resetAt: resetAt.toISOString(),
        usageId: usage.id,
      };
    });
  }

  async updateUsage(usageId: string, tokensUsed: number): Promise<void> {
    await this.prisma.aIPromptUsage.update({
      where: { id: usageId },
      data: { tokensUsed },
    });
  }

  async deleteUsage(usageId: string): Promise<void> {
    await this.prisma.aIPromptUsage.delete({
      where: { id: usageId },
    });
  }

  async getRemainingQuota(userId: string, limit?: number): Promise<{ quotaUsed: number; quotaLimit: number; remaining: number; resetAt: string }> {
    const quotaLimit = limit ?? parseInt(process.env.AI_DAILY_QUOTA || '10', 10);
    const todayUTC = this.getStartOfTodayUTC();
    const resetAt = new Date(todayUTC);
    resetAt.setUTCDate(resetAt.getUTCDate() + 1);

    const used = await this.prisma.aIPromptUsage.count({
      where: { userId, createdAt: { gte: todayUTC } },
    });

    return {
      quotaUsed: used,
      quotaLimit,
      remaining: Math.max(0, quotaLimit - used),
      resetAt: resetAt.toISOString(),
    };
  }
}
