import type {
  CompanyMember,
  PermissionKey,
  RoleName,
  RolePermissions,
  Task,
  TaskPriority,
  TaskStatus,
} from '../types/domain';

export const MAX_LENGTHS = {
  id: 128,
  email: 254,
  displayName: 120,
  photoURL: 1000,
  jobTitle: 120,
  phone: 40,
  timezone: 64,
  companyName: 120,
  companySlug: 80,
  industry: 80,
  website: 300,
  companyDescription: 1000,
  departmentName: 100,
  departmentCode: 20,
  departmentDescription: 500,
  projectName: 140,
  projectDescription: 2000,
  taskTitle: 200,
  taskDescription: 4000,
  subtaskDescription: 2000,
  commentBody: 2000,
  reportTitle: 200,
  reportDescription: 3000,
  reportResults: 4000,
  reportObservations: 3000,
  summary: 500,
} as const;

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

export const TASK_STATUSES: TaskStatus[] = [
  'To Do',
  'In Progress',
  'Under Review',
  'Blocked',
  'Completed',
  'Cancelled',
];

export const TASK_PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export const ALL_ROLES: RoleName[] = [
  'Super Administrator',
  'Company Administrator',
  'Department Manager',
  'Team Leader',
  'Employee',
  'Visitor',
];

export const PERMISSION_LABELS: { key: PermissionKey; label: string; description: string }[] = [
  { key: 'manageCompany', label: 'Company Settings', description: 'Edit company profile, timezone, and integrations' },
  { key: 'manageRoles', label: 'Role Permissions', description: 'Configure permissions for company roles' },
  { key: 'manageDepartments', label: 'Departments', description: 'Create, edit, and delete departments' },
  { key: 'manageUsers', label: 'Member Management', description: 'Change member roles, departments, and remove users' },
  { key: 'inviteUsers', label: 'Invite Staff', description: 'Invite Administrators, Managers, Team Leaders, and Employees' },
  { key: 'inviteVisitors', label: 'Invite Visitors', description: 'Invite limited-access external visitors' },
  { key: 'manageProjects', label: 'Projects', description: 'Create, update, and archive company projects' },
  { key: 'createTasks', label: 'Create Tasks', description: 'Create new tasks and subtasks' },
  { key: 'assignTasks', label: 'Assign Tasks', description: 'Assign tasks and subtasks to team members' },
  { key: 'editTasks', label: 'Edit All Tasks', description: 'Edit any task details, deadlines, and reopen completed tasks' },
  { key: 'deleteTasks', label: 'Delete Tasks', description: 'Permanently delete tasks and subtasks' },
  { key: 'viewAllTasks', label: 'View All Tasks', description: 'View tasks across all company departments' },
  { key: 'createReports', label: 'Create Reports', description: 'Submit task completion and operational reports' },
  { key: 'viewAllReports', label: 'View All Reports', description: 'Access reports created by any team member' },
  { key: 'commentOnTasks', label: 'Comments & Mentions', description: 'Post comments, replies, and @mentions on tasks' },
  { key: 'viewAuditLogs', label: 'Security Audit Logs', description: 'Inspect immutable company activity and security logs' },
];

export const DEFAULT_ROLE_POLICIES: Record<RoleName, { id: string; description: string; permissions: RolePermissions }> = {
  'Super Administrator': {
    id: 'super_administrator',
    description: 'Full unrestricted control over company settings, roles, members, departments, tasks, and audit logs.',
    permissions: {
      manageCompany: true,
      manageRoles: true,
      manageDepartments: true,
      manageUsers: true,
      inviteUsers: true,
      inviteVisitors: true,
      manageProjects: true,
      createTasks: true,
      assignTasks: true,
      editTasks: true,
      deleteTasks: true,
      viewAllTasks: true,
      createReports: true,
      viewAllReports: true,
      commentOnTasks: true,
      viewAuditLogs: true,
    },
  },
  'Company Administrator': {
    id: 'company_administrator',
    description: 'Administers workspace operations, departments, team invitations, projects, and reporting.',
    permissions: {
      manageCompany: true,
      manageRoles: true,
      manageDepartments: true,
      manageUsers: true,
      inviteUsers: true,
      inviteVisitors: true,
      manageProjects: true,
      createTasks: true,
      assignTasks: true,
      editTasks: true,
      deleteTasks: true,
      viewAllTasks: true,
      createReports: true,
      viewAllReports: true,
      commentOnTasks: true,
      viewAuditLogs: true,
    },
  },
  'Department Manager': {
    id: 'department_manager',
    description: 'Leads department execution, assigns tasks, reviews reports, and invites staff.',
    permissions: {
      manageCompany: false,
      manageRoles: false,
      manageDepartments: true,
      manageUsers: false,
      inviteUsers: true,
      inviteVisitors: true,
      manageProjects: true,
      createTasks: true,
      assignTasks: true,
      editTasks: true,
      deleteTasks: false,
      viewAllTasks: true,
      createReports: true,
      viewAllReports: true,
      commentOnTasks: true,
      viewAuditLogs: false,
    },
  },
  'Team Leader': {
    id: 'team_leader',
    description: 'Coordinates project tasks, manages subtasks, assigns team deliverables, and files reports.',
    permissions: {
      manageCompany: false,
      manageRoles: false,
      manageDepartments: false,
      manageUsers: false,
      inviteUsers: false,
      inviteVisitors: false,
      manageProjects: true,
      createTasks: true,
      assignTasks: true,
      editTasks: true,
      deleteTasks: false,
      viewAllTasks: true,
      createReports: true,
      viewAllReports: true,
      commentOnTasks: true,
      viewAuditLogs: false,
    },
  },
  Employee: {
    id: 'employee',
    description: 'Executes assigned tasks, updates subtask progress, collaborates via comments, and files completion reports.',
    permissions: {
      manageCompany: false,
      manageRoles: false,
      manageDepartments: false,
      manageUsers: false,
      inviteUsers: false,
      inviteVisitors: false,
      manageProjects: false,
      createTasks: true,
      assignTasks: false,
      editTasks: false,
      deleteTasks: false,
      viewAllTasks: true,
      createReports: true,
      viewAllReports: false,
      commentOnTasks: true,
      viewAuditLogs: false,
    },
  },
  Visitor: {
    id: 'visitor',
    description: 'Limited external access restricted to explicitly permitted projects and visitor-visible tasks.',
    permissions: {
      manageCompany: false,
      manageRoles: false,
      manageDepartments: false,
      manageUsers: false,
      inviteUsers: false,
      inviteVisitors: false,
      manageProjects: false,
      createTasks: false,
      assignTasks: false,
      editTasks: false,
      deleteTasks: false,
      viewAllTasks: false,
      createReports: false,
      viewAllReports: false,
      commentOnTasks: true,
      viewAuditLogs: false,
    },
  },
};

export function roleToDocId(role: RoleName): string {
  return DEFAULT_ROLE_POLICIES[role].id;
}

export function clampStr(value: string | undefined | null, maxLen: number): string {
  if (!value) return '';
  return value.trim().slice(0, maxLen);
}

export function sanitizeSlug(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTHS.companySlug);
  return slug.length >= 2 ? slug : `org-${Date.now().toString(36)}`;
}

export function sanitizeSafeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString().slice(0, MAX_LENGTHS.website);
    }
    return '';
  } catch {
    return '';
  }
}

export function generateSafeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 12);
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20) || 'doc';
  return `${cleanPrefix}_${Date.now().toString(36)}_${rand}`;
}

export function extractMentions(
  body: string,
  members: CompanyMember[]
): { mentionIds: string[]; mentionNames: string[] } {
  const mentionIds: string[] = [];
  const mentionNames: string[] = [];
  const lower = body.toLowerCase();

  for (const member of members) {
    const handle = `@${member.displayName.toLowerCase()}`;
    const emailPrefix = `@${member.email.split('@')[0].toLowerCase()}`;
    if (lower.includes(handle) || lower.includes(emailPrefix)) {
      if (!mentionIds.includes(member.userId) && mentionIds.length < 20) {
        mentionIds.push(member.userId);
        mentionNames.push(member.displayName);
      }
    }
  }
  return { mentionIds, mentionNames };
}

export function isTaskOverdue(task: Pick<Task, 'deadline' | 'status'>): boolean {
  if (!task.deadline) return false;
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  const due = new Date(task.deadline.length === 10 ? `${task.deadline}T23:59:59` : task.deadline);
  return !Number.isNaN(due.getTime()) && due.getTime() < Date.now();
}

export function isTaskDueSoon(task: Pick<Task, 'deadline' | 'status'>, days = 3): boolean {
  if (!task.deadline) return false;
  if (task.status === 'Completed' || task.status === 'Cancelled') return false;
  const due = new Date(task.deadline.length === 10 ? `${task.deadline}T23:59:59` : task.deadline);
  if (Number.isNaN(due.getTime())) return false;
  const diff = due.getTime() - Date.now();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

export function toMillis(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'string' || typeof ts === 'number') {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  return 0;
}

export function formatTimestamp(ts: unknown, timezone?: string): string {
  const ms = toMillis(ts);
  if (!ms) return 'Just now';
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

export function formatDateOnly(dateStr?: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

export function getCommonTimezones(): string[] {
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const list = [
    local,
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Singapore',
    'Asia/Dubai',
    'Australia/Sydney',
  ];
  return Array.from(new Set(list));
}
