import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';

@Injectable()
export class BudgetAlertService {
  private readonly logger = new Logger(BudgetAlertService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetsService: BudgetsService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async checkBudgets() {
    this.logger.log('Starting hourly budget limit check...');

    const budgets = await this.prisma.budget.findMany({
      where: { deletedAt: null },
    });

    for (const budget of budgets) {
      try {
        const statusResult = await this.budgetsService.getBudgetStatus(
          budget.id,
          budget.workspaceId,
        );
        const { spent, amount, percentage, status } = statusResult.data;

        if (percentage >= 100 && !budget.alert100Sent) {
          await this.sendAlertAndUpdate(budget, 100, percentage, spent, amount);
        } else if (percentage >= 80 && !budget.alert80Sent) {
          await this.sendAlertAndUpdate(budget, 80, percentage, spent, amount);
        }

        // Reset flags if spending drops back below threshold (new period started)
        if (percentage < 80) {
          if (budget.alert80Sent || budget.alert100Sent) {
            await this.prisma.budget.update({
              where: { id: budget.id },
              data: { alert80Sent: false, alert100Sent: false },
            });
          }
        } else if (percentage < 100 && budget.alert100Sent) {
          await this.prisma.budget.update({
            where: { id: budget.id },
            data: { alert100Sent: false },
          });
        }
      } catch (err: any) {
        this.logger.error(
          `Failed to check status for budget ${budget.id}: ${err.message}`,
        );
      }
    }

    this.logger.log('Hourly budget limit check completed.');
  }

  private async sendAlertAndUpdate(
    budget: any,
    threshold: number,
    percentage: number,
    spent: number,
    amount: number,
  ) {
    this.logger.warn(
      `Budget Alert [${threshold}%]: Budget "${budget.name}" (ID: ${budget.id}) ` +
      `in Workspace ${budget.workspaceId} has reached ${percentage.toFixed(1)}% spending ` +
      `(${spent}/${amount}).`,
    );

    // TODO Fase 7: Kirim push notification via FCM
    // TODO Fase 8: Kirim email via SMTP

    const updateData: any = {};
    if (threshold === 80) updateData.alert80Sent = true;
    if (threshold === 100) updateData.alert100Sent = true;

    await this.prisma.budget.update({
      where: { id: budget.id },
      data: updateData,
    });
  }
}
