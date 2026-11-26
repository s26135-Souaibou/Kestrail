export type RoleName =
  | 'Super Administrator'
  | 'Company Administrator'
  | 'Department Manager'
  | 'Team Leader'
  | 'Employee'
  | 'Visitor';

export type TaskStatus =
  | 'To Do'
  | 'In Progress'
  | 'Under Review'
  | 'Blocked'
  | 'Completed'
  | 'Cancelled';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type ProjectStatus = 'Planning' | 'Active' | 'On Hold' | 'Completed' | 'Archived';

export type PermissionKey =
  | 'manageCompany'
  | 'manageRoles'
  | 'manageDepartments'
  | 'manageUsers'
  | 'inviteUsers'
  | 'inviteVisitors'
  | 'manageProjects'
  | 'createTasks'
  | 'assignTasks'
  | 'editTasks'
  | 'deleteTasks'
  | 'viewAllTasks'
  | 'createReports'
  | 'viewAllReports'
  | 'commentOnTasks'
  | 'viewAuditLogs';

export type RolePermissions = Record<PermissionKey, boolean>;

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  jobTitle?: string;
  phone?: string;
  timezone: string;
  authProviders: string[];
  activeCompanyId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserMembership {
  companyId: string;
  companyName: string;
  role: RoleName;
  status: 'active' | 'suspended';
  joinedAt?: unknown;
  updatedAt?: unknown;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  industry?: string;
  timezone: string;
  website?: string;
  description?: string;
  ownerId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyMember {
  userId: string;
  companyId: string;
  email: string;
  displayName: string;
  photoURL?: string;
  jobTitle?: string;
  role: RoleName;
  departmentIds: string[];
  allowedProjectIds: string[];
  status: 'active' | 'suspended';
  invitationId?: string;
  invitedBy?: string;
  joinedAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyRole {
  id: string;
  companyId: string;
  name: RoleName;
  description?: string;
  permissions: RolePermissions;
  updatedAt?: unknown;
}

export interface Department {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string;
  managerId?: string;
  managerName?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  departmentId?: string;
  departmentName?: string;
  leadId?: string;
  leadName?: string;
  status: ProjectStatus;
  startDate?: string;
  targetDate?: string;
  visitorAccessible: boolean;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Task {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  projectId?: string;
  projectName?: string;
  departmentId?: string;
  departmentName?: string;
  assigneeId?: string;
  assigneeName?: string;
  createdBy: string;
  createdByName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  deadline?: string;
  completedAt?: string;
  subtaskCount: number;
  completedSubtaskCount: number;
  tags: string[];
  visitorVisible: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Subtask {
  id: string;
  taskId: string;
  companyId: string;
  title: string;
  description?: string;
  assigneeId?: string;
  assigneeName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate?: string;
  deadline?: string;
  completedAt?: string;
  createdBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface TaskHistoryEntry {
  id: string;
  taskId: string;
  companyId: string;
  actorId: string;
  actorName: string;
  action: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
  createdAt?: unknown;
}

export interface TaskComment {
  id: string;
  taskId: string;
  companyId: string;
  authorId: string;
  authorName: string;
  authorRole?: string;
  body: string;
  parentCommentId?: string;
  mentions: string[];
  mentionNames?: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Report {
  id: string;
  companyId: string;
  title: string;
  description?: string;
  taskId?: string;
  taskTitle?: string;
  departmentId?: string;
  departmentName?: string;
  authorId: string;
  authorName: string;
  responsibleUserId?: string;
  responsibleUserName?: string;
  taskCompletedAt?: string;
  results: string;
  observations?: string;
  attachmentLinks: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Invitation {
  id: string;
  companyId: string;
  companyName: string;
  inviteeEmail: string;
  role: Exclude<RoleName, 'Super Administrator'>;
  departmentIds: string[];
  allowedProjectIds: string[];
  status: 'pending' | 'accepted' | 'revoked';
  invitedBy: string;
  invitedByName: string;
  acceptedByUid?: string;
  expiresAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type NotificationType =
  | 'assignment'
  | 'status_change'
  | 'deadline'
  | 'overdue'
  | 'mention'
  | 'comment'
  | 'invitation'
  | 'company_update';

export interface NotificationItem {
  id: string;
  userId: string;
  companyId: string;
  companyName: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  read: boolean;
  actorId: string;
  actorName: string;
  createdAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  companyId: string;
  actorId: string;
  actorName: string;
  actorRole?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  summary: string;
  source: 'web_app' | 'api_mcp';
  createdAt?: unknown;
}

export interface IntegrationConfig {
  id: string;
  companyId: string;
  provider: 'chatgpt_mcp';
  status: 'unconfigured' | 'revoked';
  allowedScopes: string[];
  requireConfirmationForDestructive: boolean;
  updatedBy: string;
  updatedAt?: unknown;
}

export type NavSection =
  | 'dashboard'
  | 'my-tasks'
  | 'all-tasks'
  | 'projects'
  | 'departments'
  | 'reports'
  | 'calendar'
  | 'notifications'
  | 'team'
  | 'company-settings'
  | 'profile';
