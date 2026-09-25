import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { projectMemberService } from '../services/project-member.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { currentProjectMembership } from '../lib/request-project-membership.js';

const roleEnum = z.enum(['LEAD', 'MEMBER', 'VIEWER']);

const addMemberSchema = z.object({
  userId: z.string().trim().min(1, 'userId is required'),
  role: roleEnum,
});

const updateMemberRoleSchema = z.object({
  role: roleEnum,
});

interface MemberRouteParams {
  organizationId: string;
  projectId: string;
  memberId: string;
}

function memberRouteParams(request: FastifyRequest): MemberRouteParams {
  return request.params as MemberRouteParams;
}

// The acting user's own effective role in :projectId (from
// requireProjectRole()), used for the fine-grained rules in
// project-member.service.ts (e.g. "only a lead can touch another lead").
function actor(request: FastifyRequest) {
  return { userId: request.user.userId, role: currentProjectMembership(request).role };
}

export const projectMemberController = {
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { projectId } = memberRouteParams(request);
    const members = await projectMemberService.listMembers(projectId);
    sendSuccess(reply, { members });
  },

  async add(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId } = memberRouteParams(request);
    const input = parseWithSchema(addMemberSchema, request.body);
    const member = await projectMemberService.addMember(organizationId, projectId, actor(request), input);
    sendSuccess(reply, { member }, 201);
  },

  async updateRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, memberId } = memberRouteParams(request);
    const input = parseWithSchema(updateMemberRoleSchema, request.body);
    const member = await projectMemberService.updateMemberRole(
      organizationId,
      projectId,
      memberId,
      actor(request),
      input.role
    );
    sendSuccess(reply, { member });
  },

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, projectId, memberId } = memberRouteParams(request);
    await projectMemberService.removeMember(organizationId, projectId, memberId, actor(request));
    sendSuccess(reply, { message: 'Member removed successfully' });
  },
};
