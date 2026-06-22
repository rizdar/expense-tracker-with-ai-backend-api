import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleCheckerService } from '../common/services/role-checker.service';
import { BudgetsService } from '../budgets/budgets.service';
import { Prisma } from '@prisma/client';
import { format } from '@fast-csv/format';
const pdfMake = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');

// Set up pdfmake virtual file system and fonts
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || pdfFonts;
(pdfMake as any).fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleChecker: RoleCheckerService,
    private readonly budgetsService: BudgetsService,
  ) {}

  private buildDateFilter(startDate?: string, endDate?: string): any {
    const dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) {
        dateFilter.date.gte = new Date(startDate);
      }
      if (endDate) {
        dateFilter.date.lte = new Date(endDate);
      }
    }
    return dateFilter;
  }

  async getSummary(workspaceId: string, userId: string, startDate?: string, endDate?: string) {
    // 1. Role validation (Member+)
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    // 2. Fetch workspace details (currency, timezone)
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { currency: true, timezone: true },
    });

    const currency = workspace?.currency || 'IDR';

    // Build Date Filter
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // 3. Aggregate total income, expense, balance
    const incomeResult = await this.prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: 'INCOME',
        deletedAt: null,
        ...dateFilter,
      },
      _sum: { amount: true },
    });

    const expenseResult = await this.prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: 'EXPENSE',
        deletedAt: null,
        ...dateFilter,
      },
      _sum: { amount: true },
    });

    const totalIncome = Number(incomeResult._sum.amount || 0);
    const totalExpense = Number(expenseResult._sum.amount || 0);
    const balance = totalIncome - totalExpense;

    // 4. Aggregate expenses by category
    const byCategory = await this.prisma.transaction.groupBy({
      by: ['categoryId'],
      where: {
        workspaceId,
        type: 'EXPENSE',
        deletedAt: null,
        ...dateFilter,
      },
      _sum: { amount: true },
    });

    const categoryIds = byCategory.map((item) => item.categoryId);
    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, workspaceId },
      select: { id: true, name: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    const byCategoryWithNames = byCategory.map((item) => ({
      categoryId: item.categoryId,
      categoryName: categoryMap.get(item.categoryId) || 'Unknown',
      total: Number(item._sum.amount || 0),
    }));

    // 5. Budget Comparison
    const budgets = await this.prisma.budget.findMany({
      where: { workspaceId, deletedAt: null },
      select: { id: true },
    });

    const budgetComparison = [];
    for (const b of budgets) {
      try {
        const statusResult = await this.budgetsService.getBudgetStatus(b.id, workspaceId);
        if (statusResult.success && statusResult.data) {
          budgetComparison.push({
            budgetId: statusResult.data.id,
            name: statusResult.data.name,
            amount: statusResult.data.amount,
            spent: statusResult.data.spent,
            percentage: statusResult.data.percentage,
            status: statusResult.data.status,
          });
        }
      } catch (err) {
        // Continue even if one budget status check fails
      }
    }

    return {
      success: true,
      data: {
        currency,
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
        summary: {
          totalIncome,
          totalExpense,
          balance,
        },
        byCategory: byCategoryWithNames,
        budgetComparison,
      },
    };
  }

  async exportCsv(workspaceId: string, userId: string, startDate?: string, endDate?: string): Promise<Buffer> {
    // 1. Role validation
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    // Build Date Filter
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // 2. Fetch all matching transactions
    const transactions = await this.prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...dateFilter,
      },
      include: {
        category: { select: { name: true } },
        workspace: { select: { currency: true } },
      },
      orderBy: { date: 'asc' },
    });

    // 3. Map rows for CSV formatting
    const rows = transactions.map((t) => ({
      Date: t.date.toISOString(),
      Type: t.type,
      Category: t.category.name,
      Amount: t.amount.toString(),
      Currency: t.workspace.currency,
      Notes: t.notes || '',
      Source: t.source,
    }));

    // 4. Build CSV Buffer in memory
    const csvStream = format({ headers: true });
    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      csvStream
        .on('data', (chunk: Buffer) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .on('error', (err) => reject(err));

      rows.forEach((row) => csvStream.write(row));
      csvStream.end();
    });
  }

  async exportPdf(workspaceId: string, userId: string, startDate?: string, endDate?: string): Promise<Buffer> {
    // 1. Role validation
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);

    // Fetch workspace details
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true, currency: true },
    });

    const workspaceName = workspace?.name || 'Workspace';
    const currency = workspace?.currency || 'IDR';

    // Build Date Filter
    const dateFilter = this.buildDateFilter(startDate, endDate);

    // 2. Fetch matching transactions
    const transactions = await this.prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...dateFilter,
      },
      include: {
        category: { select: { name: true } },
      },
      orderBy: { date: 'asc' },
    });

    // 3. Calculate summary metrics
    const incomeResult = await this.prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: 'INCOME',
        deletedAt: null,
        ...dateFilter,
      },
      _sum: { amount: true },
    });

    const expenseResult = await this.prisma.transaction.aggregate({
      where: {
        workspaceId,
        type: 'EXPENSE',
        deletedAt: null,
        ...dateFilter,
      },
      _sum: { amount: true },
    });

    const totalIncome = Number(incomeResult._sum.amount || 0);
    const totalExpense = Number(expenseResult._sum.amount || 0);
    const balance = totalIncome - totalExpense;

    // Format strings
    const periodStr = `Period: ${startDate ? new Date(startDate).toISOString().split('T')[0] : 'All'} – ${
      endDate ? new Date(endDate).toISOString().split('T')[0] : 'All'
    }`;

    // 4. Construct pdfmake document definition
    const docDefinition: any = {
      content: [
        { text: workspaceName, style: 'header' },
        { text: `Currency: ${currency}  |  ${periodStr}`, margin: [0, 2, 0, 15] },
        
        { text: 'Financial Summary', style: 'subheader' },
        {
          table: {
            widths: ['*', '*', '*'],
            body: [
              [
                { text: 'Total Income', bold: true, fillColor: '#e2f0d9', alignment: 'center' },
                { text: 'Total Expense', bold: true, fillColor: '#fce4d6', alignment: 'center' },
                { text: 'Net Balance', bold: true, fillColor: '#fff2cc', alignment: 'center' },
              ],
              [
                { text: `${currency} ${totalIncome.toLocaleString()}`, alignment: 'center' },
                { text: `${currency} ${totalExpense.toLocaleString()}`, alignment: 'center' },
                { text: `${currency} ${balance.toLocaleString()}`, alignment: 'center', bold: true },
              ],
            ],
          },
          margin: [0, 0, 0, 20],
        },

        { text: 'Transactions Ledger', style: 'subheader' },
        {
          table: {
            headerRows: 1,
            widths: ['auto', 'auto', 'auto', 'auto', 'auto', '*', 'auto'],
            body: [
              [
                { text: 'Date', bold: true, fillColor: '#f2f2f2' },
                { text: 'Type', bold: true, fillColor: '#f2f2f2' },
                { text: 'Category', bold: true, fillColor: '#f2f2f2' },
                { text: 'Amount', bold: true, fillColor: '#f2f2f2' },
                { text: 'Currency', bold: true, fillColor: '#f2f2f2' },
                { text: 'Notes', bold: true, fillColor: '#f2f2f2' },
                { text: 'Source', bold: true, fillColor: '#f2f2f2' },
              ],
              ...transactions.map((t) => [
                new Date(t.date).toISOString().split('T')[0],
                t.type,
                t.category.name,
                t.amount.toString(),
                currency,
                t.notes || '',
                t.source,
              ]),
            ],
          },
        },
        { text: `Generated at: ${new Date().toISOString()}`, style: 'footer', alignment: 'right', margin: [0, 20, 0, 0] },
      ],
      styles: {
        header: { fontSize: 20, bold: true },
        subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        footer: { fontSize: 9, color: 'gray' },
      },
    };

    // 5. Generate and return PDF Buffer
    const pdfDocGenerator = pdfMake.createPdf(docDefinition);
    return new Promise<Buffer>((resolve) => {
      pdfDocGenerator.getBuffer((buffer: Buffer) => resolve(buffer));
    });
  }
}
