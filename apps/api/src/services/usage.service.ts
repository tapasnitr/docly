import { dashboardRepository, type StorageUsage } from '../repositories/dashboard.repository.js';

export interface AiUsage {
  conversationCount: number;
  messageCount: number;
  messagesByRole: { user: number; assistant: number };
}

export interface UsageData {
  storage: StorageUsage;
  ai: AiUsage;
}

// Service layer: business logic for the usage domain. Same caveat as
// dashboard.service.ts - AI usage is a real aggregate over AiConversation/
// AiMessage, which stay empty until the (separate, future) document
// processing and AI features actually create rows.
export const usageService = {
  async getUsage(organizationId: string): Promise<UsageData> {
    const [storage, conversationCount, messageRoleCounts] = await Promise.all([
      dashboardRepository.getStorageUsage(organizationId),
      dashboardRepository.countAiConversations(organizationId),
      dashboardRepository.countAiMessagesByRole(organizationId),
    ]);

    const byRole = new Map(messageRoleCounts.map((row) => [row.role, row.count]));
    const userMessages = byRole.get('user') ?? 0;
    const assistantMessages = byRole.get('assistant') ?? 0;

    return {
      storage,
      ai: {
        conversationCount,
        messageCount: userMessages + assistantMessages,
        messagesByRole: { user: userMessages, assistant: assistantMessages },
      },
    };
  },
};
