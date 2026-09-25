import type { Project as PrismaProject, ProjectRole, ProjectStatus } from '@docly/database';
import type { Project, ProjectSummary } from '@docly/types';
import { projectRepository, type ListProjectsOptions } from '../repositories/project.repository.js';
import { projectMemberRepository } from '../repositories/project-member.repository.js';
import { organizationMemberRepository } from '../repositories/organization-member.repository.js';
import { auditLogRepository } from '../repositories/audit-log.repository.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  dueDate?: Date | null;
  // Organization members to add as initial project MEMBERs alongside the
  // creator (who is always added as LEAD - see createProject below).
  memberIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  status?: ProjectStatus;
  startDate?: Date | null;
  dueDate?: Date | null;
}

// taskCount/progress have no real data source until Task Management ships -
// fixed placeholders until then (see the plan's "out of scope" section).
//
// Builds the response explicitly (not `...project`) because the list path
// passes rows that carry Prisma's `_count` alongside the real columns -
// spreading it would leak that key into the JSON response.
function toSummary(project: PrismaProject, role: ProjectRole, memberCount: number): ProjectSummary {
  const base: Project = {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    dueDate: project.dueDate,
    createdById: project.createdById,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
  return { ...base, role, memberCount, taskCount: 0, progress: null };
}

// Service layer: business logic for the project domain. Organization/project
// role checks for a specific request already happened in
// requireOrganizationRole()/requireProjectRole() by the time these run -
// this only encodes rules about the data itself.
export const projectService = {
  async createProject(
    organizationId: string,
    creatorUserId: string,
    input: CreateProjectInput
  ): Promise<ProjectSummary> {
    const memberIds = [...new Set(input.memberIds ?? [])].filter((id) => id !== creatorUserId);
    if (memberIds.length > 0) {
      const memberships = await Promise.all(
        memberIds.map((userId) => organizationMemberRepository.findMembership(userId, organizationId))
      );
      if (memberships.some((membership) => !membership)) {
        throw new ValidationError('One or more initial members are not members of this organization');
      }
    }

    const project = await projectRepository.createWithLead(
      {
        organizationId,
        name: input.name,
        description: input.description,
        status: input.status,
        startDate: input.startDate,
        dueDate: input.dueDate,
        createdById: creatorUserId,
      },
      creatorUserId,
      memberIds
    );

    await auditLogRepository.record({
      organizationId,
      userId: creatorUserId,
      action: 'project.created',
      resourceType: 'project',
      resourceId: project.id,
      changes: { name: input.name },
    });

    return toSummary(project, 'LEAD', memberIds.length + 1);
  },

  async listProjectsForOrganization(
    organizationId: string,
    options: ListProjectsOptions
  ): Promise<{ projects: ProjectSummary[]; total: number }> {
    const { projects, total } = await projectRepository.listForOrganization(organizationId, options);

    // memberUserId is only set for non-admin callers (see
    // projectController.list) - every returned project already matched
    // `members: { some: { userId: memberUserId } } }`, so a role is
    // guaranteed to exist. Admins don't hold an explicit ProjectMember row
    // for every project they can see, so their effective role is LEAD,
    // same as everywhere else (see lib/project-rbac.ts).
    const roleByProjectId = options.memberUserId
      ? await projectMemberRepository.findRolesForUser(
          options.memberUserId,
          projects.map((project) => project.id)
        )
      : null;

    return {
      total,
      projects: projects.map((project) =>
        toSummary(project, roleByProjectId?.get(project.id) ?? 'LEAD', project._count.members)
      ),
    };
  },

  async getProject(organizationId: string, projectId: string, viewerRole: ProjectRole): Promise<ProjectSummary> {
    const project = await projectRepository.findByIdInOrganization(projectId, organizationId);
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    const members = await projectMemberRepository.listByProject(projectId);
    return toSummary(project, viewerRole, members.length);
  },

  async updateProject(
    organizationId: string,
    projectId: string,
    actorUserId: string,
    actorRole: ProjectRole,
    input: UpdateProjectInput
  ): Promise<ProjectSummary> {
    const existing = await projectRepository.findByIdInOrganization(projectId, organizationId);
    if (!existing) {
      throw new NotFoundError('Project not found');
    }

    const updated = await projectRepository.update(projectId, input);
    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: input.status && input.status !== existing.status ? 'project.status_changed' : 'project.updated',
      resourceType: 'project',
      resourceId: projectId,
      changes: input,
    });

    const members = await projectMemberRepository.listByProject(projectId);
    return toSummary(updated, actorRole, members.length);
  },

  async deleteProject(organizationId: string, projectId: string, actorUserId: string): Promise<void> {
    const existing = await projectRepository.findByIdInOrganization(projectId, organizationId);
    if (!existing) {
      throw new NotFoundError('Project not found');
    }

    // Recorded before the delete, same as organizationService.deleteOrganization -
    // the entry deliberately outlives the resource it describes.
    await auditLogRepository.record({
      organizationId,
      userId: actorUserId,
      action: 'project.deleted',
      resourceType: 'project',
      resourceId: projectId,
      changes: { name: existing.name },
    });
    await projectRepository.delete(projectId);
  },
};
