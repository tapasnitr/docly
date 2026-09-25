import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { organizationMemberService } from '../services/organization-member.service.js';
import { parseWithSchema } from '../middleware/validate.js';
import { sendSuccess } from '../lib/api-response.js';
import { currentMembership } from '../lib/request-membership.js';

const roleEnum = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']);

const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  role: roleEnum,
});

const updateMemberRoleSchema = z.object({
  role: roleEnum,
});

interface MemberRouteParams {
  organizationId: string;
  memberId: string;
}

function memberRouteParams(request: FastifyRequest): MemberRouteParams {
  return request.params as MemberRouteParams;
}

// The acting user's own verified role in :organizationId (from
// requireOrganizationRole()), used for the fine-grained rules in
// organization-member.service.ts (e.g. "only an owner can touch another
// owner").
function actor(request: FastifyRequest) {
  return { userId: request.user.userId, role: currentMembership(request).role };
}

export const organizationMemberController = {
  async list(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId } = memberRouteParams(request);
    const members = await organizationMemberService.listMembers(organizationId);
    sendSuccess(reply, { members });
  },

  async add(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId } = memberRouteParams(request);
    const input = parseWithSchema(addMemberSchema, request.body);
    const member = await organizationMemberService.addMember(organizationId, actor(request), input);
    sendSuccess(reply, { member }, 201);
  },

  async updateRole(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, memberId } = memberRouteParams(request);
    const input = parseWithSchema(updateMemberRoleSchema, request.body);
    const member = await organizationMemberService.updateMemberRole(
      organizationId,
      memberId,
      actor(request),
      input.role
    );
    sendSuccess(reply, { member });
  },

  async remove(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const { organizationId, memberId } = memberRouteParams(request);
    await organizationMemberService.removeMember(organizationId, memberId, actor(request));
    sendSuccess(reply, { message: 'Member removed successfully' });
  },
};
