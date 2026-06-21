import { Injectable, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoleCheckerService } from '../common/services/role-checker.service';
import { QuotaService } from './quota.service';
import OpenAI from 'openai';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfParse = require('pdf-parse');

interface CompletionOptions {
  systemPrompt: string;
  userPrompt: string | Array<any>;
  model: string;
  type: 'CHAT' | 'OCR' | 'INSIGHTS';
  workspaceId: string;
  userId: string;
}

@Injectable()
export class AiService {
  private client: OpenAI;

  constructor(
    private readonly prisma: PrismaService,
    private readonly roleChecker: RoleCheckerService,
    private readonly quotaService: QuotaService,
  ) {
    this.client = new OpenAI({
      apiKey: process.env.AI_API_KEY || 'dummy-key',
      baseURL: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
    });
  }

  private getModel(modelOverride?: string): string {
    return modelOverride || process.env.AI_MODEL || 'deepseek-v4-pro';
  }

  private isVisionCapable(model: string): boolean {
    const m = model.toLowerCase();
    return (
      m.includes('gpt-4o') ||
      m.includes('vision') ||
      m.includes('gpt-4-turbo') ||
      m.includes('glm-5.1') ||
      m.includes('gemini')
    );
  }

  private cleanJsonResponse(content: string): string {
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.substring(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.substring(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3);
    }
    return cleaned.trim();
  }

  private getConfidenceThreshold(): number {
    return process.env.AI_CONFIDENCE_THRESHOLD
      ? parseFloat(process.env.AI_CONFIDENCE_THRESHOLD)
      : 0.7;
  }

  private parseAiJsonResponse(content: string): any {
    try {
      return JSON.parse(this.cleanJsonResponse(content));
    } catch (err) {
      throw new HttpException(
        {
          success: false,
          error: 'AI_PARSING_FAILED',
          message: 'Failed to parse JSON response from AI',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async callOpenAIWithRetry(options: CompletionOptions): Promise<{ content: string; tokensUsed: number }> {
    const { systemPrompt, userPrompt, model, type, workspaceId, userId } = options;
    const timeout = process.env.AI_TIMEOUT ? parseInt(process.env.AI_TIMEOUT, 10) : 15000;
    const limit = process.env.AI_DAILY_QUOTA ? parseInt(process.env.AI_DAILY_QUOTA, 10) : 10;

    const quota = await this.quotaService.checkAndReserveQuota(workspaceId, userId, limit, type, model);
    if (!quota.allowed) {
      throw new HttpException(
        {
          success: false,
          error: 'AI_QUOTA_EXCEEDED',
          quotaUsed: quota.quotaUsed,
          quotaLimit: limit,
          resetAt: quota.resetAt,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const usageId = quota.usageId!;

    // Check for mock AI API Key to support testing environments without paid keys
    if (process.env.AI_API_KEY === 'sk-xxxx' || process.env.AI_API_KEY === 'mock-key') {
      let content = '';
      if (type === 'CHAT') {
        content = JSON.stringify({
          amount: 45000,
          type: 'EXPENSE',
          category: 'Food',
          notes: 'Beli makanan siang seharga 45000 rupiah',
          date: new Date().toISOString(),
          confidence: 0.95,
        });
      } else if (type === 'OCR') {
        content = JSON.stringify({
          amount: 120000,
          type: 'EXPENSE',
          category: 'Food',
          notes: 'McDonalds Store Jakarta total',
          date: new Date().toISOString(),
          confidence: 0.9,
          merchant: 'McDonalds',
          items: ['Burger 50k', 'Fries 30k'],
        });
      } else if (type === 'INSIGHTS') {
        content = JSON.stringify({
          patterns: [
            { category: 'Food', trend: 'stable', insight: 'Spending on food is normal.' },
          ],
          anomalies: [
            { type: 'DUPLICATE', description: 'Possible duplicate McD transactions detected', relatedTransactionIds: [] },
          ],
          budgetWarnings: [],
        });
      }
      const tokensUsed = 150;
      await this.quotaService.updateUsage(usageId, tokensUsed);
      return { content, tokensUsed };
    }

    let attempts = 0;
    let responseError: any = null;

    while (attempts < 2) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        attempts++;
        const messages: any[] = [{ role: 'system', content: systemPrompt }];
        if (typeof userPrompt === 'string') {
          messages.push({ role: 'user', content: userPrompt });
        } else {
          messages.push({ role: 'user', content: userPrompt });
        }

        const supportsJsonFormat =
          model.includes('gpt-4') ||
          model.includes('gpt-5') ||
          model.includes('gpt-3.5') ||
          model.includes('glm') ||
          process.env.AI_PROVIDER === 'openai';

        const response = await this.client.chat.completions.create(
          {
            model,
            messages,
            response_format: supportsJsonFormat ? { type: 'json_object' } : undefined,
          },
          { signal: controller.signal },
        );

        clearTimeout(timeoutId);

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty AI response');
        }

        const tokensUsed = response.usage?.total_tokens || 0;
        await this.quotaService.updateUsage(usageId, tokensUsed);

        return { content, tokensUsed };
      } catch (err: any) {
        clearTimeout(timeoutId);
        responseError = err;

        const isNetworkError = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.name === 'AbortError';
        const isRateLimit = err.status === 429;

        if ((isNetworkError || isRateLimit) && attempts < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }

        break;
      }
    }

    await this.quotaService.deleteUsage(usageId);
    throw new HttpException(
      {
        success: false,
        error: 'AI_PARSING_FAILED',
        message: responseError?.message || 'Failed to communicate with AI model',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private async matchCategory(
    workspaceId: string,
    categoryName: string,
    type: string,
  ): Promise<{ categoryId: string | null; matched: boolean; matchedName?: string }> {
    if (!categoryName) return { categoryId: null, matched: false };

    // Exact match (case-insensitive) by name + type
    let cat = await this.prisma.category.findFirst({
      where: {
        workspaceId,
        name: { equals: categoryName, mode: 'insensitive' },
        type,
        deletedAt: null,
      },
    });

    // Partial match fallback
    if (!cat) {
      cat = await this.prisma.category.findFirst({
        where: {
          workspaceId,
          name: { contains: categoryName, mode: 'insensitive' },
          type,
          deletedAt: null,
        },
      });
    }

    if (cat) {
      return { categoryId: cat.id, matched: true, matchedName: cat.name };
    }

    return { categoryId: null, matched: false };
  }

  async parseChat(userId: string, workspaceId: string, text: string, modelOverride?: string) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);
    const model = this.getModel(modelOverride);

    const systemPrompt = `You are a financial transaction parser. Extract transaction information from user input.
Reply ONLY with valid JSON. No markdown, no explanation, no code fences.

Format:
{
  "amount": number,
  "type": "EXPENSE" | "INCOME",
  "category": string,
  "notes": string,
  "date": "ISO8601",
  "confidence": number (0-1)
}

Rules:
- amount: numeric value, no currency symbols
- type: EXPENSE for spending, INCOME for receiving money
- category: one word/phrase from common categories (e.g., Food, Transport, Shopping, Bills, Entertainment, Health, Salary, Investment, Freelance, Bonus)
- notes: brief summary of the transaction
- date: ISO 8601 format, infer from context or use current date
- confidence: your certainty level (0-1) based on how clear the input is`;

    const { content } = await this.callOpenAIWithRetry({
      systemPrompt,
      userPrompt: `Input: "${text}"`,
      model,
      type: 'CHAT',
      workspaceId,
      userId,
    });

    const parsed = this.parseAiJsonResponse(content);

    const matchResult = await this.matchCategory(workspaceId, parsed.category, parsed.type || 'EXPENSE');
    const confidenceThreshold = this.getConfidenceThreshold();

    return {
      success: true,
      message: 'Chat parsed successfully',
      data: {
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        categoryId: matchResult.categoryId,
        categoryMatched: matchResult.matched,
        matchedCategoryName: matchResult.matchedName || null,
        notes: parsed.notes || null,
        date: parsed.date || new Date().toISOString(),
        confidence: parsed.confidence || 0,
        lowConfidence: (parsed.confidence || 0) < confidenceThreshold,
      },
    };
  }

  async parseReceipt(userId: string, workspaceId: string, file: Express.Multer.File, modelOverride?: string) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);
    const model = this.getModel(modelOverride);

    const systemPrompt = `You are a financial receipt/invoice parser. Extract transaction details from the provided content.
Reply ONLY with valid JSON. No markdown, no explanation, no code fences.

Format:
{
  "amount": number,
  "type": "EXPENSE" | "INCOME",
  "category": string,
  "notes": string,
  "date": "ISO8601",
  "confidence": number (0-1),
  "merchant": string,
  "items": string[]
}

Rules:
- amount: total transaction amount, numeric value
- type: EXPENSE (default for receipts) or INCOME
- category: common category (e.g., Food, Transport, Shopping, Bills)
- notes: summary of purchase
- merchant: name of store/merchant
- items: list of items purchased (e.g., ["Susu 15rb", "Roti 10rb"])
- date: ISO 8601 format of the transaction date`;

    let userPrompt: string | Array<any>;

    if (file.mimetype === 'application/pdf') {
      let extractedText = '';
      try {
        const pdfData = await pdfParse(file.buffer);
        extractedText = pdfData.text;
      } catch (err: any) {
        throw new HttpException(
          {
            success: false,
            error: 'AI_PARSING_FAILED',
            message: `Failed to extract text from PDF: ${err.message}`,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
      userPrompt = `Parsed PDF Content:\n${extractedText}`;
    } else {
      // Vision image upload
      if (!this.isVisionCapable(model)) {
        throw new BadRequestException('Current AI model does not support image processing. Switch to a vision-capable model.');
      }
      const base64Image = file.buffer.toString('base64');
      const imageUrl = `data:${file.mimetype};base64,${base64Image}`;
      userPrompt = [
        { type: 'text', text: 'Extract receipt details from this image.' },
        { type: 'image_url', image_url: { url: imageUrl } },
      ];
    }

    const { content } = await this.callOpenAIWithRetry({
      systemPrompt,
      userPrompt,
      model,
      type: 'OCR',
      workspaceId,
      userId,
    });

    const parsed = this.parseAiJsonResponse(content);

    const matchResult = await this.matchCategory(workspaceId, parsed.category, parsed.type || 'EXPENSE');
    const confidenceThreshold = this.getConfidenceThreshold();

    return {
      success: true,
      message: 'Receipt parsed successfully',
      data: {
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        categoryId: matchResult.categoryId,
        categoryMatched: matchResult.matched,
        matchedCategoryName: matchResult.matchedName || null,
        notes: parsed.notes || null,
        date: parsed.date || new Date().toISOString(),
        confidence: parsed.confidence || 0,
        lowConfidence: (parsed.confidence || 0) < confidenceThreshold,
        merchant: parsed.merchant || null,
        items: parsed.items || [],
      },
    };
  }

  async getInsights(userId: string, workspaceId: string, startDate?: string, endDate?: string) {
    await this.roleChecker.checkRole(workspaceId, userId, ['OWNER', 'ADMIN', 'VIEWER']);
    const model = this.getModel();

    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    const transactions = await this.prisma.transaction.findMany({
      where: {
        workspaceId,
        deletedAt: null,
        ...(startDate || endDate ? { date: dateFilter } : {}),
      },
      include: {
        category: true,
      },
      orderBy: {
        date: 'desc',
      },
      take: 100,
    });

    const budgets = await this.prisma.budget.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      include: {
        category: true,
      },
    });

    const transactionsContext = transactions
      .map(
        (t) =>
          `- Date: ${t.date.toISOString()} | Amount: ${t.amount.toString()} | Type: ${t.type} | Category: ${
            t.category?.name || 'Unknown'
          } | Notes: ${t.notes || ''} | ID: ${t.id}`,
      )
      .join('\n');

    const budgetsContext = budgets
      .map(
        (b) =>
          `- Category: ${b.category?.name || 'All'} | Limit: ${b.amount.toString()} | Period: ${b.period}`,
      )
      .join('\n');

    const systemPrompt = `You are a financial analyst. Analyze the provided transactions and return patterns, anomalies, and budget concerns.
Reply ONLY with valid JSON. No markdown, no explanation, no code fences.

Format:
{
  "patterns": [
    { "category": string, "trend": "increasing" | "decreasing" | "stable", "insight": string }
  ],
  "anomalies": [
    { "type": string, "description": string, "relatedTransactionIds": string[] }
  ],
  "budgetWarnings": [
    { "category": string, "currentSpending": number, "budgetLimit": number, "percentage": number }
  ]
}

Rules for Anomaly Detection:
- Detect duplicate transactions (e.g. same amount, same category, and date less than 5 minutes apart). Add their IDs to relatedTransactionIds.`;

    const userPrompt = `Budgets:\n${budgetsContext || 'No budgets configured.'}\n\nTransactions:\n${
      transactionsContext || 'No transactions found.'
    }`;

    const { content } = await this.callOpenAIWithRetry({
      systemPrompt,
      userPrompt,
      model,
      type: 'INSIGHTS',
      workspaceId,
      userId,
    });

    try {
      const parsed = JSON.parse(this.cleanJsonResponse(content));
      return {
        success: true,
        message: 'Financial insights generated successfully',
        data: parsed,
      };
    } catch (err) {
      throw new HttpException(
        {
          success: false,
          error: 'AI_PARSING_FAILED',
          message: 'Failed to parse JSON response from AI',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }
}
