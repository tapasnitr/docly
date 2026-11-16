// User types. Organization membership is NOT here - a user can belong to
// more than one organization (with a different role in each), tracked by
// OrganizationMember. See JwtPayload below for why the access token only
// carries userId.
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  emailNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Organization types
export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

// Billing tier / lifecycle state. Not user-editable via the general update
// endpoint - see the comment on Organization.plan in schema.prisma.
export type OrganizationPlan = 'FREE' | 'PRO' | 'ENTERPRISE';
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED';

// Owner/Admin-configurable organization preferences. Always returned fully
// shaped (every key present) by the API, even though the DB column is
// stored sparse - see apps/api/src/lib/organization-settings.ts.
export interface OrganizationSettings {
  defaults: {
    // Role assigned to a member added without an explicit role.
    defaultMemberRole: Exclude<OrganizationRole, 'OWNER'>;
    // Days to retain documents before they're eligible for cleanup, or null
    // to keep them indefinitely. Not enforced by any job yet.
    documentRetentionDays: number | null;
  };
  memberPermissions: {
    // Whether MEMBER (not just ADMIN+) may invite/add new members.
    membersCanInvite: boolean;
    // Whether MEMBER (not just ADMIN+) may delete documents.
    membersCanDeleteDocuments: boolean;
  };
  ai: {
    enabled: boolean;
    // Whether MEMBER (not just ADMIN+) may use AI features once built.
    allowMemberAccess: boolean;
  };
  notifications: {
    notifyOnDocumentProcessed: boolean;
    notifyOnMemberJoined: boolean;
  };
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: OrganizationPlan;
  status: OrganizationStatus;
  settings: OrganizationSettings;
  createdAt: Date;
  updatedAt: Date;
}

// An organization as returned to the current user - includes their own role
// in it, since that's almost always what the UI needs alongside the org.
export interface OrganizationSummary extends Organization {
  role: OrganizationRole;
}

export interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: Date;
  user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'>;
}

// Document types
// pending = uploaded and queued for processing; processing = the worker is
// extracting text; ready = processed; failed = see processingError (Retry).
export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

export interface Document {
  id: string;
  organizationId: string;
  projectId: string | null;
  title: string;
  filename: string;
  mimeType: string;
  size: number;
  status: DocumentStatus;
  processingError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// A document as returned by the API, with its uploader and project.
export interface DocumentSummary extends Document {
  // Number of text chunks extracted by processing (0 until it is ready).
  chunkCount: number;
  uploadedBy: Pick<User, 'id' | 'name' | 'email'>;
  project: { id: string; name: string } | null;
}

// Document chunk for RAG
export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
  createdAt: Date;
}

// API response envelope conventions.
// Every API response is one of the two shapes below, discriminated on `success`.
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
  timestamp: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// Project types
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED';

// Ascending privilege, mirrors OrganizationRole but scoped to a project -
// see the comment on the ProjectRole enum in schema.prisma. There's no
// project-level OWNER; an organization OWNER/ADMIN always resolves to LEAD.
export type ProjectRole = 'VIEWER' | 'MEMBER' | 'LEAD';

export interface Project {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: Date | null;
  dueDate: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

// A project as returned to the current user - includes their own effective
// role (see apps/api/src/lib/project-rbac.ts) and summary counts for the
// list/detail views. taskCount is the project's total tasks; progress is the
// percentage of them that are DONE (null while there are no tasks yet).
export interface ProjectSummary extends Project {
  role: ProjectRole;
  memberCount: number;
  taskCount: number;
  progress: number | null;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: ProjectRole;
  createdAt: Date;
  user: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'>;
}

// Task types
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Task {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdById: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// A task as returned by the API: the row plus its assignee's public profile.
export interface TaskSummary extends Task {
  assignee: Pick<User, 'id' | 'email' | 'name' | 'avatarUrl'> | null;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Job types
export interface ProcessingJob {
  id: string;
  documentId: string;
  jobType: 'extract' | 'embed' | 'index';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Dashboard types (GET /organizations/:organizationId/dashboard)
export interface DocumentCounts {
  total: number;
  processing: number;
  completed: number;
  failed: number;
}

export interface RecentDocument {
  id: string;
  title: string;
  filename: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  size: number;
  createdAt: Date;
  uploadedBy: Pick<User, 'id' | 'name' | 'email'>;
}

export interface ProjectCounts {
  total: number;
  planning: number;
  active: number;
  onHold: number;
  completed: number;
  archived: number;
}

export interface RecentProject {
  id: string;
  name: string;
  status: ProjectStatus;
  dueDate: Date | null;
  updatedAt: Date;
  memberCount: number;
}

export interface DashboardSummary {
  organization: OrganizationSummary;
  documentCounts: DocumentCounts;
  recentDocuments: RecentDocument[];
  projectCounts: ProjectCounts;
  recentProjects: RecentProject[];
  memberCount: number;
}

// Activity types (GET /organizations/:organizationId/activity)
export interface ActivityEntry {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: unknown;
  createdAt: Date;
  actor: Pick<User, 'id' | 'name' | 'email' | 'avatarUrl'> | null;
}

// Usage types (GET /organizations/:organizationId/usage)
export interface StorageUsage {
  usedBytes: number;
  documentCount: number;
}

export interface AiUsage {
  conversationCount: number;
  messageCount: number;
  messagesByRole: { user: number; assistant: number };
}

export interface UsageSummary {
  storage: StorageUsage;
  ai: AiUsage;
}

// JWT payload. Deliberately just an identity claim - no organizationId/role,
// since a user's role can differ per organization and can change (or be
// revoked) after the token was issued. Every organization-scoped request
// re-checks membership/role against the database for the organizationId in
// the URL, rather than trusting anything embedded in the token.
export interface JwtPayload {
  userId: string;
  iat: number;
  exp: number;
}
