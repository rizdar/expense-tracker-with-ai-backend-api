import { Injectable, Logger } from '@nestjs/common';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getMessaging, MulticastMessage } from 'firebase-admin/messaging';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private readonly app: App | null = null;
  private readonly enabled: boolean;

  constructor(private readonly prisma: PrismaService) {
    const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH;

    if (serviceAccountPath) {
      try {
        // Avoid re-initializing if already initialized
        if (getApps().length === 0) {
          this.app = initializeApp({
            credential: cert(serviceAccountPath),
          });
        } else {
          this.app = getApps()[0];
        }
        this.enabled = true;
        this.logger.log('FCM initialized with service account');
      } catch (error: any) {
        this.enabled = false;
        this.logger.warn(`FCM initialization failed: ${error.message}. Notifications will be simulated.`);
      }
    } else {
      this.enabled = false;
      this.logger.warn('FCM_SERVICE_ACCOUNT_PATH not set, notifications will be simulated.');
    }
  }

  async sendToUser(
    userId: string,
    tokens: string[],
    notification: { title: string; body: string; data?: Record<string, string> },
  ) {
    if (!this.enabled || tokens.length === 0) {
      this.logger.log(`[FCM SIMULATION] To user ${userId}: ${notification.title} — ${notification.body}`);
      return;
    }

    const message: MulticastMessage = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data ?? {},
    };

    try {
      const response = await getMessaging().sendEachForMulticast(message);
      this.logger.log(`[FCM] Sent to ${response.successCount}/${tokens.length} devices for user ${userId}.`);

      // Cleanup invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (resp.error?.code === 'messaging/registration-token-not-registered') {
            invalidTokens.push(tokens[idx]);
          }
        });

        if (invalidTokens.length > 0) {
          await this.prisma.deviceToken.deleteMany({
            where: { token: { in: invalidTokens } },
          });
          this.logger.log(`[FCM] Cleaned up ${invalidTokens.length} invalid tokens.`);
        }
      }

      return response;
    } catch (error: any) {
      this.logger.error(`[FCM] Send error for user ${userId}: ${error.message}`);
    }
  }

  async sendToWorkspaceMembers(
    workspaceId: string,
    notification: { title: string; body: string; data?: Record<string, string> },
  ) {
    // Find all OWNER and ADMIN members
    const members = await this.prisma.workspaceMember.findMany({
      where: {
        workspaceId,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { userId: true },
    });

    const memberIds = members.map((m) => m.userId);

    if (memberIds.length === 0) return;

    const deviceTokens = await this.prisma.deviceToken.findMany({
      where: { userId: { in: memberIds } },
    });

    // Group tokens by userId
    const tokensByUser = new Map<string, string[]>();
    for (const dt of deviceTokens) {
      const list = tokensByUser.get(dt.userId) || [];
      list.push(dt.token);
      tokensByUser.set(dt.userId, list);
    }

    for (const [userId, tokens] of tokensByUser) {
      await this.sendToUser(userId, tokens, notification);
    }
  }
}
