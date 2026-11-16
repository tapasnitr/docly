import { prisma } from '@docly/database';

// Data access for document Q&A. Every lookup is scoped by organization and
// project, so a document id from another tenant can never be read.
export const aiRepository = {
  findDocument(organizationId: string, projectId: string, documentId: string) {
    return prisma.document.findFirst({
      where: { id: documentId, organizationId, projectId },
      select: { id: true, status: true },
    });
  },

  listChunks(documentId: string) {
    return prisma.documentChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
      select: { id: true, chunkIndex: true, text: true, embedding: true },
    });
  },

  findConversation(documentId: string, conversationId: string) {
    return prisma.aiConversation.findFirst({ where: { id: conversationId, documentId }, select: { id: true } });
  },

  createConversation(documentId: string) {
    return prisma.aiConversation.create({ data: { documentId }, select: { id: true } });
  },

  addMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
    return prisma.aiMessage.create({ data: { conversationId, role, content } });
  },
};
