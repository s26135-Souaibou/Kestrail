import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type WriteBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  ALL_ROLES,
  clampStr,
  DEFAULT_ROLE_POLICIES,
  extractMentions,
  generateSafeId,
  MAX_LENGTHS,
  roleToDocId,
  sanitizeSafeUrl,
  sanitizeSlug,
} from './validators';
import type {
  Company,
  CompanyMember,
  Department,
  IntegrationConfig,
  Invitation,
  NotificationType,
  Project,
  ProjectStatus,
  Report,
  RoleName,
  RolePermissions,
  Subtask,
  Task,
  TaskPriority,
  TaskStatus,
  UserProfile,
} from '../types/domain';

export interface ActorContext {
  uid: string;
  displayName: string;
  email: string;
  role?: RoleName;
  companyName?: string;
}

function appendAuditLogToBatch(
  batch: WriteBatch,
  companyId: string,
  actor: ActorContext,
  action: string,
  resourceType: string,
  resourceId: string,
  summary: string
) {
  const logId = generateSafeId('log');
  const ref = doc(db, 'companies', companyId, 'auditLogs', logId);
  batch.set(ref, {
    id: logId,
    companyId,
    actorId: actor.uid,
    actorName: clampStr(actor.displayName || actor.email, MAX_LENGTHS.displayName),
    actorRole: clampStr(actor.role || 'Member', 64),
    action: clampStr(action, 100),
    resourceType: clampStr(resourceType, 64),
    resourceId: clampStr(resourceId, MAX_LENGTHS.id),
    summary: clampStr(summary, MAX_LENGTHS.summary),
    source: 'web_app',
    createdAt: serverTimestamp(),
  });
}

function appendTaskHistoryToBatch(
  batch: WriteBatch,
  companyId: string,
  taskId: string,
  actor: ActorContext,
  action: string,
  field?: string,
  oldValue?: string,
  newValue?: string
) {
  const historyId = generateSafeId('hist');
  const ref = doc(db, 'companies', companyId, 'tasks', taskId, 'history', historyId);
  const payload: Record<string, unknown> = {
    id: historyId,
    taskId,
    companyId,
    actorId: actor.uid,
    actorName: clampStr(actor.displayName || actor.email, MAX_LENGTHS.displayName),
    action: clampStr(action, 100),
    createdAt: serverTimestamp(),
  };
  if (field) payload.field = clampStr(field, 64);
  if (oldValue !== undefined) payload.oldValue = clampStr(oldValue, 500);
  if (newValue !== undefined) payload.newValue = clampStr(newValue, 500);
  batch.set(ref, payload);
}

function appendNotificationToBatch(
  batch: WriteBatch,
  targetUserId: string,
  companyId: string,
  companyName: string,
  actor: ActorContext,
  type: NotificationType,
  title: string,
  message: string,
  entityType?: string,
  entityId?: string
) {
  if (!targetUserId || targetUserId === actor.uid) return;
  const notifId = generateSafeId('notif');
  const ref = doc(db, 'users', targetUserId, 'notifications', notifId);
  const payload: Record<string, unknown> = {
    id: notifId,
    userId: targetUserId,
    companyId,
    companyName: clampStr(companyName, MAX_LENGTHS.companyName),
    type,
    title: clampStr(title, 160),
    message: clampStr(message, 500),
    read: false,
    actorId: actor.uid,
    actorName: clampStr(actor.displayName || actor.email, MAX_LENGTHS.displayName),
    createdAt: serverTimestamp(),
  };
  if (entityType) payload.entityType = clampStr(entityType, 40);
  if (entityId) payload.entityId = clampStr(entityId, MAX_LENGTHS.id);
  batch.set(ref, payload);
}

export async function upsertUserProfile(
  uid: string,
  input: {
    email: string;
    displayName: string;
    photoURL?: string;
    jobTitle?: string;
    phone?: string;
    timezone: string;
    authProviders: string[];
    activeCompanyId?: string;
  },
  isNew: boolean
): Promise<void> {
  const path = `users/${uid}`;
  try {
    const ref = doc(db, 'users', uid);
    const cleanProviders = input.authProviders.filter(Boolean).slice(0, 5);
    const payload: Record<string, unknown> = {
      uid,
      email: clampStr(input.email.toLowerCase(), MAX_LENGTHS.email),
      displayName: clampStr(input.displayName || input.email.split('@')[0], MAX_LENGTHS.displayName),
      timezone: clampStr(input.timezone || 'UTC', MAX_LENGTHS.timezone),
      authProviders: cleanProviders.length ? cleanProviders : ['password'],
      updatedAt: serverTimestamp(),
    };
    if (input.photoURL !== undefined) payload.photoURL = clampStr(input.photoURL, MAX_LENGTHS.photoURL);
    if (input.jobTitle !== undefined) payload.jobTitle = clampStr(input.jobTitle, MAX_LENGTHS.jobTitle);
    if (input.phone !== undefined) payload.phone = clampStr(input.phone, MAX_LENGTHS.phone);
    if (input.activeCompanyId !== undefined) payload.activeCompanyId = clampStr(input.activeCompanyId, MAX_LENGTHS.id);

    if (isNew) {
      payload.createdAt = serverTimestamp();
      await setDoc(ref, payload);
    } else {
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function updateActiveCompanyId(uid: string, companyId: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      activeCompanyId: clampStr(companyId, MAX_LENGTHS.id),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createCompanyWorkspace(
  actor: ActorContext,
  userProfile: UserProfile,
  input: {
    name: string;
    industry?: string;
    timezone: string;
    website?: string;
    description?: string;
    seedDefaultDepartments?: boolean;
  }
): Promise<string> {
  const companyId = generateSafeId('comp');
  const path = `companies/${companyId}`;
  try {
    const batch = writeBatch(db);
    const cleanName = clampStr(input.name, MAX_LENGTHS.companyName);
    const slug = sanitizeSlug(cleanName);
    const cleanWebsite = input.website ? sanitizeSafeUrl(input.website) : '';

    const companyData: Record<string, unknown> = {
      id: companyId,
      name: cleanName,
      slug,
      timezone: clampStr(input.timezone || 'UTC', MAX_LENGTHS.timezone),
      ownerId: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (input.industry) companyData.industry = clampStr(input.industry, MAX_LENGTHS.industry);
    if (cleanWebsite) companyData.website = cleanWebsite;
    if (input.description) companyData.description = clampStr(input.description, MAX_LENGTHS.companyDescription);

    batch.set(doc(db, 'companies', companyId), companyData);

    const memberData: Record<string, unknown> = {
      userId: actor.uid,
      companyId,
      email: clampStr(actor.email.toLowerCase(), MAX_LENGTHS.email),
      displayName: clampStr(userProfile.displayName || actor.displayName, MAX_LENGTHS.displayName),
      role: 'Super Administrator',
      departmentIds: [],
      allowedProjectIds: [],
      status: 'active',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (userProfile.photoURL) memberData.photoURL = clampStr(userProfile.photoURL, MAX_LENGTHS.photoURL);
    if (userProfile.jobTitle) memberData.jobTitle = clampStr(userProfile.jobTitle, MAX_LENGTHS.jobTitle);

    batch.set(doc(db, 'companies', companyId, 'members', actor.uid), memberData);

    batch.set(doc(db, 'users', actor.uid, 'memberships', companyId), {
      companyId,
      companyName: cleanName,
      role: 'Super Administrator',
      status: 'active',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Seed all 6 configurable RBAC roles
    for (const roleName of ALL_ROLES) {
      const policy = DEFAULT_ROLE_POLICIES[roleName];
      batch.set(doc(db, 'companies', companyId, 'roles', policy.id), {
        id: policy.id,
        companyId,
        name: roleName,
        description: policy.description,
        permissions: policy.permissions,
        updatedAt: serverTimestamp(),
      });
    }

    // Seed core departments if requested
    if (input.seedDefaultDepartments !== false) {
      const defaults = [
        { name: 'Management', code: 'MGT', description: 'Executive leadership and strategic planning' },
        { name: 'Operations', code: 'OPS', description: 'Day-to-day company operations and delivery' },
        { name: 'IT', code: 'IT', description: 'Engineering, security, and internal systems' },
      ];
      for (const dept of defaults) {
        const deptId = generateSafeId('dept');
        batch.set(doc(db, 'companies', companyId, 'departments', deptId), {
          id: deptId,
          companyId,
          name: dept.name,
          code: dept.code,
          description: dept.description,
          managerId: actor.uid,
          managerName: clampStr(userProfile.displayName || actor.displayName, MAX_LENGTHS.displayName),
          createdBy: actor.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    // Set active company on user profile
    batch.update(doc(db, 'users', actor.uid), {
      activeCompanyId: companyId,
      updatedAt: serverTimestamp(),
    });

    appendAuditLogToBatch(
      batch,
      companyId,
      { ...actor, role: 'Super Administrator' },
      'company.created',
      'company',
      companyId,
      `Created company workspace "${cleanName}"`
    );

    await batch.commit();
    return companyId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCompanyInfo(
  companyId: string,
  actor: ActorContext,
  input: Partial<Pick<Company, 'name' | 'industry' | 'timezone' | 'website' | 'description'>>
): Promise<void> {
  const path = `companies/${companyId}`;
  try {
    const batch = writeBatch(db);
    const cleanName = input.name ? clampStr(input.name, MAX_LENGTHS.companyName) : undefined;
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (cleanName) {
      payload.name = cleanName;
      payload.slug = sanitizeSlug(cleanName);
    }
    if (input.industry !== undefined) payload.industry = clampStr(input.industry, MAX_LENGTHS.industry);
    if (input.timezone !== undefined) payload.timezone = clampStr(input.timezone, MAX_LENGTHS.timezone);
    if (input.website !== undefined) {
      payload.website = input.website ? sanitizeSafeUrl(input.website) : '';
    }
    if (input.description !== undefined) {
      payload.description = clampStr(input.description, MAX_LENGTHS.companyDescription);
    }

    batch.update(doc(db, 'companies', companyId), payload);
    if (cleanName) {
      batch.update(doc(db, 'users', actor.uid, 'memberships', companyId), {
        companyName: cleanName,
        updatedAt: serverTimestamp(),
      });
    }

    appendAuditLogToBatch(
      batch,
      companyId,
      actor,
      'company.updated',
      'company',
      companyId,
      `Updated company profile settings`
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateRolePermissions(
  companyId: string,
  roleName: RoleName,
  permissions: RolePermissions,
  actor: ActorContext
): Promise<void> {
  const roleId = roleToDocId(roleName);
  const path = `companies/${companyId}/roles/${roleId}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'companies', companyId, 'roles', roleId), {
      permissions,
      updatedAt: serverTimestamp(),
    });
    appendAuditLogToBatch(
      batch,
      companyId,
      actor,
      'role.permissions_updated',
      'role',
      roleId,
      `Updated permissions for role "${roleName}"`
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createInvitation(
  companyId: string,
  companyName: string,
  actor: ActorContext,
  input: {
    inviteeEmail: string;
    role: Exclude<RoleName, 'Super Administrator'>;
    departmentIds: string[];
    allowedProjectIds: string[];
    expiresInDays?: number;
  }
): Promise<string> {
  const invitationId = generateSafeId('inv');
  const path = `invitations/${invitationId}`;
  try {
    const batch = writeBatch(db);
    const expiresDate = new Date(Date.now() + (input.expiresInDays || 14) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    batch.set(doc(db, 'invitations', invitationId), {
      id: invitationId,
      companyId,
      companyName: clampStr(companyName, MAX_LENGTHS.companyName),
      inviteeEmail: clampStr(input.inviteeEmail.toLowerCase(), MAX_LENGTHS.email),
      role: input.role,
      departmentIds: input.departmentIds.slice(0, 20),
      allowedProjectIds: input.allowedProjectIds.slice(0, 50),
      status: 'pending',
      invitedBy: actor.uid,
      invitedByName: clampStr(actor.displayName || actor.email, MAX_LENGTHS.displayName),
      expiresAt: expiresDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    appendAuditLogToBatch(
      batch,
      companyId,
      actor,
      'invitation.created',
      'invitation',
      invitationId,
      `Invited ${input.inviteeEmail.toLowerCase()} as ${input.role}`
    );

    await batch.commit();
    return invitationId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function revokeInvitation(
  invitation: Invitation,
  actor: ActorContext
): Promise<void> {
  const path = `invitations/${invitation.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'invitations', invitation.id), {
      status: 'revoked',
      updatedAt: serverTimestamp(),
    });
    appendAuditLogToBatch(
      batch,
      invitation.companyId,
      actor,
      'invitation.revoked',
      'invitation',
      invitation.id,
      `Revoked invitation for ${invitation.inviteeEmail}`
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function acceptInvitationById(
  invitationId: string,
  user: UserProfile
): Promise<string> {
  const path = `invitations/${invitationId}`;
  try {
    const invSnap = await getDoc(doc(db, 'invitations', invitationId.trim()));
    if (!invSnap.exists()) {
      throw new Error('Invitation not found. Verify the invitation code.');
    }
    const inv = invSnap.data() as Invitation;
    if (inv.status !== 'pending') {
      throw new Error(`This invitation has already been ${inv.status}.`);
    }
    if (inv.inviteeEmail.toLowerCase() !== user.email.toLowerCase()) {
      throw new Error(`This invitation was issued for ${inv.inviteeEmail}.`);
    }

    const batch = writeBatch(db);
    batch.update(doc(db, 'invitations', inv.id), {
      status: 'accepted',
      acceptedByUid: user.uid,
      updatedAt: serverTimestamp(),
    });

    const memberPayload: Record<string, unknown> = {
      userId: user.uid,
      companyId: inv.companyId,
      email: clampStr(user.email.toLowerCase(), MAX_LENGTHS.email),
      displayName: clampStr(user.displayName, MAX_LENGTHS.displayName),
      role: inv.role,
      departmentIds: (inv.departmentIds || []).slice(0, 20),
      allowedProjectIds: (inv.allowedProjectIds || []).slice(0, 50),
      status: 'active',
      invitationId: inv.id,
      invitedBy: inv.invitedBy,
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) memberPayload.photoURL = clampStr(user.photoURL, MAX_LENGTHS.photoURL);
    if (user.jobTitle) memberPayload.jobTitle = clampStr(user.jobTitle, MAX_LENGTHS.jobTitle);

    batch.set(doc(db, 'companies', inv.companyId, 'members', user.uid), memberPayload);

    batch.set(doc(db, 'users', user.uid, 'memberships', inv.companyId), {
      companyId: inv.companyId,
      companyName: clampStr(inv.companyName, MAX_LENGTHS.companyName),
      role: inv.role,
      status: 'active',
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.update(doc(db, 'users', user.uid), {
      activeCompanyId: inv.companyId,
      updatedAt: serverTimestamp(),
    });

    appendAuditLogToBatch(
      batch,
      inv.companyId,
      { uid: user.uid, displayName: user.displayName, email: user.email, role: inv.role },
      'member.joined',
      'member',
      user.uid,
      `${user.displayName} accepted invitation as ${inv.role}`
    );

    await batch.commit();
    return inv.companyId;
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Invitation') || error.message.includes('issued for'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateCompanyMember(
  companyId: string,
  companyName: string,
  targetMember: CompanyMember,
  updates: {
    role: RoleName;
    departmentIds: string[];
    allowedProjectIds: string[];
    status: 'active' | 'suspended';
    jobTitle?: string;
  },
  actor: ActorContext
): Promise<void> {
  const path = `companies/${companyId}/members/${targetMember.userId}`;
  try {
    const batch = writeBatch(db);
    const memberPayload: Record<string, unknown> = {
      role: updates.role,
      departmentIds: updates.departmentIds.slice(0, 20),
      allowedProjectIds: updates.allowedProjectIds.slice(0, 50),
      status: updates.status,
      updatedAt: serverTimestamp(),
    };
    if (updates.jobTitle !== undefined) {
      memberPayload.jobTitle = clampStr(updates.jobTitle, MAX_LENGTHS.jobTitle);
    }

    batch.update(doc(db, 'companies', companyId, 'members', targetMember.userId), memberPayload);

    batch.set(
      doc(db, 'users', targetMember.userId, 'memberships', companyId),
      {
        companyId,
        companyName: clampStr(companyName, MAX_LENGTHS.companyName),
        role: updates.role,
        status: updates.status,
        joinedAt: targetMember.joinedAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    appendAuditLogToBatch(
      batch,
      companyId,
      actor,
      'member.updated',
      'member',
      targetMember.userId,
      `Updated ${targetMember.displayName} (${updates.role}, ${updates.status})`
    );

    appendNotificationToBatch(
      batch,
      targetMember.userId,
      companyId,
      companyName,
      actor,
      'company_update',
      'Membership updated',
      `Your role in ${companyName} is now ${updates.role}.`,
      'company',
      companyId
    );

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeCompanyMember(
  companyId: string,
  targetMember: CompanyMember,
  actor: ActorContext
): Promise<void> {
  const path = `companies/${companyId}/members/${targetMember.userId}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'companies', companyId, 'members', targetMember.userId));
    batch.delete(doc(db, 'users', targetMember.userId, 'memberships', companyId));
    appendAuditLogToBatch(
      batch,
      companyId,
      actor,
      'member.removed',
      'member',
      targetMember.userId,
      `Removed ${targetMember.displayName} (${targetMember.email}) from company`
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDepartment(
  companyId: string,
  actor: ActorContext,
  input: {
    id?: string;
    name: string;
    code: string;
    description?: string;
    managerId?: string;
    managerName?: string;
  }
): Promise<string> {
  const isCreate = !input.id;
  const deptId = input.id || generateSafeId('dept');
  const path = `companies/${companyId}/departments/${deptId}`;
  try {
    const batch = writeBatch(db);
    const payload: Record<string, unknown> = {
      name: clampStr(input.name, MAX_LENGTHS.departmentName),
      code: clampStr(input.code.toUpperCase(), MAX_LENGTHS.departmentCode),
      description: clampStr(input.description, MAX_LENGTHS.departmentDescription),
      managerId: clampStr(input.managerId, MAX_LENGTHS.id),
      managerName: clampStr(input.managerName, MAX_LENGTHS.displayName),
      updatedAt: serverTimestamp(),
    };

    if (isCreate) {
      batch.set(doc(db, 'companies', companyId, 'departments', deptId), {
        id: deptId,
        companyId,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        ...payload,
      });
      appendAuditLogToBatch(batch, companyId, actor, 'department.created', 'department', deptId, `Created department "${input.name}"`);
    } else {
      batch.update(doc(db, 'companies', companyId, 'departments', deptId), payload);
      appendAuditLogToBatch(batch, companyId, actor, 'department.updated', 'department', deptId, `Updated department "${input.name}"`);
    }

    await batch.commit();
    return deptId;
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function removeDepartment(
  companyId: string,
  dept: Department,
  actor: ActorContext
): Promise<void> {
  const path = `companies/${companyId}/departments/${dept.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'companies', companyId, 'departments', dept.id));
    appendAuditLogToBatch(batch, companyId, actor, 'department.deleted', 'department', dept.id, `Deleted department "${dept.name}"`);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveProject(
  companyId: string,
  actor: ActorContext,
  input: {
    id?: string;
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
  }
): Promise<string> {
  const isCreate = !input.id;
  const projectId = input.id || generateSafeId('proj');
  const path = `companies/${companyId}/projects/${projectId}`;
  try {
    const batch = writeBatch(db);
    const payload: Record<string, unknown> = {
      name: clampStr(input.name, MAX_LENGTHS.projectName),
      description: clampStr(input.description, MAX_LENGTHS.projectDescription),
      departmentId: clampStr(input.departmentId, MAX_LENGTHS.id),
      departmentName: clampStr(input.departmentName, MAX_LENGTHS.departmentName),
      leadId: clampStr(input.leadId, MAX_LENGTHS.id),
      leadName: clampStr(input.leadName, MAX_LENGTHS.displayName),
      status: input.status,
      startDate: clampStr(input.startDate, 40),
      targetDate: clampStr(input.targetDate, 40),
      visitorAccessible: Boolean(input.visitorAccessible),
      updatedAt: serverTimestamp(),
    };

    if (isCreate) {
      batch.set(doc(db, 'companies', companyId, 'projects', projectId), {
        id: projectId,
        companyId,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        ...payload,
      });
      appendAuditLogToBatch(batch, companyId, actor, 'project.created', 'project', projectId, `Created project "${input.name}"`);
    } else {
      batch.update(doc(db, 'companies', companyId, 'projects', projectId), payload);
      appendAuditLogToBatch(batch, companyId, actor, 'project.updated', 'project', projectId, `Updated project "${input.name}"`);
    }

    await batch.commit();
    return projectId;
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function removeProject(
  companyId: string,
  project: Project,
  actor: ActorContext
): Promise<void> {
  const path = `companies/${companyId}/projects/${project.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'companies', companyId, 'projects', project.id));
    appendAuditLogToBatch(batch, companyId, actor, 'project.deleted', 'project', project.id, `Deleted project "${project.name}"`);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createTask(
  companyId: string,
  companyName: string,
  actor: ActorContext,
  input: {
    title: string;
    description?: string;
    projectId?: string;
    projectName?: string;
    departmentId?: string;
    departmentName?: string;
    assigneeId?: string;
    assigneeName?: string;
    status: TaskStatus;
    priority: TaskPriority;
    startDate?: string;
    deadline?: string;
    tags?: string[];
    visitorVisible?: boolean;
  }
): Promise<string> {
  const taskId = generateSafeId('task');
  const path = `companies/${companyId}/tasks/${taskId}`;
  try {
    const batch = writeBatch(db);
    const cleanTitle = clampStr(input.title, MAX_LENGTHS.taskTitle);
    const completedAt = input.status === 'Completed' ? new Date().toISOString().slice(0, 10) : '';

    batch.set(doc(db, 'companies', companyId, 'tasks', taskId), {
      id: taskId,
      companyId,
      title: cleanTitle,
      description: clampStr(input.description, MAX_LENGTHS.taskDescription),
      projectId: clampStr(input.projectId, MAX_LENGTHS.id),
      projectName: clampStr(input.projectName, MAX_LENGTHS.projectName),
      departmentId: clampStr(input.departmentId, MAX_LENGTHS.id),
      departmentName: clampStr(input.departmentName, MAX_LENGTHS.departmentName),
      assigneeId: clampStr(input.assigneeId, MAX_LENGTHS.id),
      assigneeName: clampStr(input.assigneeName, MAX_LENGTHS.displayName),
      createdBy: actor.uid,
      createdByName: clampStr(actor.displayName || actor.email, MAX_LENGTHS.displayName),
      status: input.status,
      priority: input.priority,
      startDate: clampStr(input.startDate, 40),
      deadline: clampStr(input.deadline, 40),
      completedAt,
      subtaskCount: 0,
      completedSubtaskCount: 0,
      tags: (input.tags || []).map((t) => clampStr(t, 40)).filter(Boolean).slice(0, 10),
      visitorVisible: Boolean(input.visitorVisible),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    appendTaskHistoryToBatch(batch, companyId, taskId, actor, 'Task created', 'status', '', input.status);
    appendAuditLogToBatch(batch, companyId, actor, 'task.created', 'task', taskId, `Created task "${cleanTitle}"`);

    if (input.assigneeId) {
      appendNotificationToBatch(
        batch,
        input.assigneeId,
        companyId,
        companyName,
        actor,
        'assignment',
        'New task assigned',
        `${actor.displayName} assigned you to "${cleanTitle}".`,
        'task',
        taskId
      );
    }

    await batch.commit();
    return taskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateTask(
  companyId: string,
  companyName: string,
  existingTask: Task,
  actor: ActorContext,
  updates: Partial<{
    title: string;
    description: string;
    projectId: string;
    projectName: string;
    departmentId: string;
    departmentName: string;
    assigneeId: string;
    assigneeName: string;
    status: TaskStatus;
    priority: TaskPriority;
    startDate: string;
    deadline: string;
    completedAt: string;
    tags: string[];
    visitorVisible: boolean;
  }>,
  isStatusOnlyUpdate = false
): Promise<void> {
  const path = `companies/${companyId}/tasks/${existingTask.id}`;
  try {
    const batch = writeBatch(db);
    const payload: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };

    if (isStatusOnlyUpdate) {
      if (updates.status !== undefined) {
        payload.status = updates.status;
        payload.completedAt =
          updates.status === 'Completed'
            ? updates.completedAt || new Date().toISOString().slice(0, 10)
            : '';
      }
    } else {
      if (updates.title !== undefined) payload.title = clampStr(updates.title, MAX_LENGTHS.taskTitle);
      if (updates.description !== undefined) payload.description = clampStr(updates.description, MAX_LENGTHS.taskDescription);
      if (updates.projectId !== undefined) payload.projectId = clampStr(updates.projectId, MAX_LENGTHS.id);
      if (updates.projectName !== undefined) payload.projectName = clampStr(updates.projectName, MAX_LENGTHS.projectName);
      if (updates.departmentId !== undefined) payload.departmentId = clampStr(updates.departmentId, MAX_LENGTHS.id);
      if (updates.departmentName !== undefined) payload.departmentName = clampStr(updates.departmentName, MAX_LENGTHS.departmentName);
      if (updates.assigneeId !== undefined) payload.assigneeId = clampStr(updates.assigneeId, MAX_LENGTHS.id);
      if (updates.assigneeName !== undefined) payload.assigneeName = clampStr(updates.assigneeName, MAX_LENGTHS.displayName);
      if (updates.priority !== undefined) payload.priority = updates.priority;
      if (updates.startDate !== undefined) payload.startDate = clampStr(updates.startDate, 40);
      if (updates.deadline !== undefined) payload.deadline = clampStr(updates.deadline, 40);
      if (updates.tags !== undefined) {
        payload.tags = updates.tags.map((t) => clampStr(t, 40)).filter(Boolean).slice(0, 10);
      }
      if (updates.visitorVisible !== undefined) payload.visitorVisible = Boolean(updates.visitorVisible);
      if (updates.status !== undefined) {
        payload.status = updates.status;
        if (updates.status === 'Completed') {
          payload.completedAt = updates.completedAt || existingTask.completedAt || new Date().toISOString().slice(0, 10);
        } else {
          payload.completedAt = '';
        }
      }
    }

    batch.update(doc(db, 'companies', companyId, 'tasks', existingTask.id), payload);

    if (updates.status && updates.status !== existingTask.status) {
      appendTaskHistoryToBatch(
        batch,
        companyId,
        existingTask.id,
        actor,
        'Status changed',
        'status',
        existingTask.status,
        updates.status
      );
      if (existingTask.assigneeId) {
        appendNotificationToBatch(
          batch,
          existingTask.assigneeId,
          companyId,
          companyName,
          actor,
          'status_change',
          'Task status updated',
          `"${existingTask.title}" moved from ${existingTask.status} to ${updates.status}.`,
          'task',
          existingTask.id
        );
      }
      if (existingTask.createdBy && existingTask.createdBy !== existingTask.assigneeId) {
        appendNotificationToBatch(
          batch,
          existingTask.createdBy,
          companyId,
          companyName,
          actor,
          'status_change',
          'Task status updated',
          `"${existingTask.title}" moved from ${existingTask.status} to ${updates.status}.`,
          'task',
          existingTask.id
        );
      }
    }

    if (updates.priority && updates.priority !== existingTask.priority) {
      appendTaskHistoryToBatch(
        batch,
        companyId,
        existingTask.id,
        actor,
        'Priority changed',
        'priority',
        existingTask.priority,
        updates.priority
      );
    }

    if (updates.assigneeId !== undefined && updates.assigneeId !== existingTask.assigneeId) {
      appendTaskHistoryToBatch(
        batch,
        companyId,
        existingTask.id,
        actor,
        'Assignee changed',
        'assigneeName',
        existingTask.assigneeName || 'Unassigned',
        updates.assigneeName || 'Unassigned'
      );
      if (updates.assigneeId) {
        appendNotificationToBatch(
          batch,
          updates.assigneeId,
          companyId,
          companyName,
          actor,
          'assignment',
          'Task assigned to you',
          `${actor.displayName} assigned you to "${updates.title || existingTask.title}".`,
          'task',
          existingTask.id
        );
      }
    }

    appendAuditLogToBatch(
      batch,
      companyId,
      actor,
      'task.updated',
      'task',
      existingTask.id,
      `Updated task "${updates.title || existingTask.title}"`
    );

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteTask(
  companyId: string,
  task: Task,
  actor: ActorContext
): Promise<void> {
  const path = `companies/${companyId}/tasks/${task.id}`;
  try {
    const batch = writeBatch(db);
    // Clean up subtasks under task
    const subsSnap = await getDocs(collection(db, 'companies', companyId, 'tasks', task.id, 'subtasks'));
    subsSnap.forEach((s) => batch.delete(s.ref));
    batch.delete(doc(db, 'companies', companyId, 'tasks', task.id));
    appendAuditLogToBatch(batch, companyId, actor, 'task.deleted', 'task', task.id, `Deleted task "${task.title}"`);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSubtask(
  companyId: string,
  companyName: string,
  parentTask: Task,
  allSubtasks: Subtask[],
  actor: ActorContext,
  input: {
    id?: string;
    title: string;
    description?: string;
    assigneeId?: string;
    assigneeName?: string;
    status: TaskStatus;
    priority: TaskPriority;
    startDate?: string;
    deadline?: string;
    completedAt?: string;
  },
  isStatusOnly = false
): Promise<string> {
  const isCreate = !input.id;
  const subtaskId = input.id || generateSafeId('sub');
  const path = `companies/${companyId}/tasks/${parentTask.id}/subtasks/${subtaskId}`;
  try {
    const batch = writeBatch(db);
    const completedAt =
      input.status === 'Completed'
        ? input.completedAt || new Date().toISOString().slice(0, 10)
        : '';

    if (isCreate) {
      batch.set(doc(db, 'companies', companyId, 'tasks', parentTask.id, 'subtasks', subtaskId), {
        id: subtaskId,
        taskId: parentTask.id,
        companyId,
        title: clampStr(input.title, MAX_LENGTHS.taskTitle),
        description: clampStr(input.description, MAX_LENGTHS.subtaskDescription),
        assigneeId: clampStr(input.assigneeId, MAX_LENGTHS.id),
        assigneeName: clampStr(input.assigneeName, MAX_LENGTHS.displayName),
        status: input.status,
        priority: input.priority,
        startDate: clampStr(input.startDate, 40),
        deadline: clampStr(input.deadline, 40),
        completedAt,
        createdBy: actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else if (isStatusOnly) {
      batch.update(doc(db, 'companies', companyId, 'tasks', parentTask.id, 'subtasks', subtaskId), {
        status: input.status,
        completedAt,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(doc(db, 'companies', companyId, 'tasks', parentTask.id, 'subtasks', subtaskId), {
        title: clampStr(input.title, MAX_LENGTHS.taskTitle),
        description: clampStr(input.description, MAX_LENGTHS.subtaskDescription),
        assigneeId: clampStr(input.assigneeId, MAX_LENGTHS.id),
        assigneeName: clampStr(input.assigneeName, MAX_LENGTHS.displayName),
        status: input.status,
        priority: input.priority,
        startDate: clampStr(input.startDate, 40),
        deadline: clampStr(input.deadline, 40),
        completedAt,
        updatedAt: serverTimestamp(),
      });
    }

    // Recompute parent subtask progress counters
    const updatedList = isCreate
      ? [...allSubtasks, { status: input.status } as Subtask]
      : allSubtasks.map((s) => (s.id === subtaskId ? { ...s, status: input.status } : s));

    const subtaskCount = Math.trunc(updatedList.length);
    const completedSubtaskCount = Math.trunc(
      updatedList.filter((s) => s.status === 'Completed').length
    );

    batch.update(doc(db, 'companies', companyId, 'tasks', parentTask.id), {
      subtaskCount,
      completedSubtaskCount,
      updatedAt: serverTimestamp(),
    });

    appendTaskHistoryToBatch(
      batch,
      companyId,
      parentTask.id,
      actor,
      isCreate ? `Subtask added: ${input.title}` : `Subtask updated: ${input.title}`,
      'subtask',
      '',
      input.status
    );

    if (input.assigneeId && isCreate) {
      appendNotificationToBatch(
        batch,
        input.assigneeId,
        companyId,
        companyName,
        actor,
        'assignment',
        'Subtask assigned',
        `${actor.displayName} assigned you subtask "${input.title}" under "${parentTask.title}".`,
        'task',
        parentTask.id
      );
    }

    await batch.commit();
    return subtaskId;
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function deleteSubtask(
  companyId: string,
  parentTask: Task,
  subtask: Subtask,
  allSubtasks: Subtask[],
  actor: ActorContext
): Promise<void> {
  const path = `companies/${companyId}/tasks/${parentTask.id}/subtasks/${subtask.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'companies', companyId, 'tasks', parentTask.id, 'subtasks', subtask.id));

    const remaining = allSubtasks.filter((s) => s.id !== subtask.id);
    batch.update(doc(db, 'companies', companyId, 'tasks', parentTask.id), {
      subtaskCount: Math.trunc(remaining.length),
      completedSubtaskCount: Math.trunc(remaining.filter((s) => s.status === 'Completed').length),
      updatedAt: serverTimestamp(),
    });

    appendTaskHistoryToBatch(
      batch,
      companyId,
      parentTask.id,
      actor,
      `Subtask removed: ${subtask.title}`
    );

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addTaskComment(
  companyId: string,
  companyName: string,
  task: Task,
  members: CompanyMember[],
  actor: ActorContext,
  body: string,
  parentCommentId?: string
): Promise<string> {
  const commentId = generateSafeId('cmt');
  const path = `companies/${companyId}/tasks/${task.id}/comments/${commentId}`;
  try {
    const batch = writeBatch(db);
    const { mentionIds, mentionNames } = extractMentions(body, members);

    const payload: Record<string, unknown> = {
      id: commentId,
      taskId: task.id,
      companyId,
      authorId: actor.uid,
      authorName: clampStr(actor.displayName || actor.email, MAX_LENGTHS.displayName),
      authorRole: clampStr(actor.role || 'Member', 64),
      body: clampStr(body, MAX_LENGTHS.commentBody),
      mentions: mentionIds,
      mentionNames,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (parentCommentId) {
      payload.parentCommentId = clampStr(parentCommentId, MAX_LENGTHS.id);
    }

    batch.set(doc(db, 'companies', companyId, 'tasks', task.id, 'comments', commentId), payload);

    // Notify mentioned members
    for (const targetUid of mentionIds) {
      appendNotificationToBatch(
        batch,
        targetUid,
        companyId,
        companyName,
        actor,
        'mention',
        `Mentioned in "${task.title}"`,
        `${actor.displayName} mentioned you: "${clampStr(body, 140)}"`,
        'task',
        task.id
      );
    }

    // Notify task assignee if not already mentioned
    if (task.assigneeId && !mentionIds.includes(task.assigneeId)) {
      appendNotificationToBatch(
        batch,
        task.assigneeId,
        companyId,
        companyName,
        actor,
        'comment',
        `New comment on "${task.title}"`,
        `${actor.displayName} commented: "${clampStr(body, 140)}"`,
        'task',
        task.id
      );
    }

    await batch.commit();
    return commentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteTaskComment(
  companyId: string,
  taskId: string,
  commentId: string
): Promise<void> {
  const path = `companies/${companyId}/tasks/${taskId}/comments/${commentId}`;
  try {
    await deleteDoc(doc(db, 'companies', companyId, 'tasks', taskId, 'comments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveReport(
  companyId: string,
  actor: ActorContext,
  input: {
    id?: string;
    title: string;
    description?: string;
    taskId?: string;
    taskTitle?: string;
    departmentId?: string;
    departmentName?: string;
    responsibleUserId?: string;
    responsibleUserName?: string;
    taskCompletedAt?: string;
    results: string;
    observations?: string;
    attachmentLinks?: string[];
  }
): Promise<string> {
  const isCreate = !input.id;
  const reportId = input.id || generateSafeId('rep');
  const path = `companies/${companyId}/reports/${reportId}`;
  try {
    const batch = writeBatch(db);
    const validLinks = (input.attachmentLinks || [])
      .map((l) => sanitizeSafeUrl(l))
      .filter(Boolean)
      .slice(0, 5);

    const payload: Record<string, unknown> = {
      title: clampStr(input.title, MAX_LENGTHS.reportTitle),
      description: clampStr(input.description, MAX_LENGTHS.reportDescription),
      taskId: clampStr(input.taskId, MAX_LENGTHS.id),
      taskTitle: clampStr(input.taskTitle, MAX_LENGTHS.taskTitle),
      departmentId: clampStr(input.departmentId, MAX_LENGTHS.id),
      departmentName: clampStr(input.departmentName, MAX_LENGTHS.departmentName),
      responsibleUserId: clampStr(input.responsibleUserId || actor.uid, MAX_LENGTHS.id),
      responsibleUserName: clampStr(input.responsibleUserName || actor.displayName, MAX_LENGTHS.displayName),
      taskCompletedAt: clampStr(input.taskCompletedAt, 40),
      results: clampStr(input.results, MAX_LENGTHS.reportResults),
      observations: clampStr(input.observations, MAX_LENGTHS.reportObservations),
      attachmentLinks: validLinks,
      updatedAt: serverTimestamp(),
    };

    if (isCreate) {
      batch.set(doc(db, 'companies', companyId, 'reports', reportId), {
        id: reportId,
        companyId,
        authorId: actor.uid,
        authorName: clampStr(actor.displayName || actor.email, MAX_LENGTHS.displayName),
        createdAt: serverTimestamp(),
        ...payload,
      });
      appendAuditLogToBatch(batch, companyId, actor, 'report.created', 'report', reportId, `Filed report "${input.title}"`);
    } else {
      batch.update(doc(db, 'companies', companyId, 'reports', reportId), payload);
      appendAuditLogToBatch(batch, companyId, actor, 'report.updated', 'report', reportId, `Updated report "${input.title}"`);
    }

    await batch.commit();
    return reportId;
  } catch (error) {
    handleFirestoreError(error, isCreate ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function removeReport(
  companyId: string,
  report: Report,
  actor: ActorContext
): Promise<void> {
  const path = `companies/${companyId}/reports/${report.id}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'companies', companyId, 'reports', report.id));
    appendAuditLogToBatch(batch, companyId, actor, 'report.deleted', 'report', report.id, `Deleted report "${report.title}"`);
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function markNotificationRead(userId: string, notificationId: string, read = true): Promise<void> {
  const path = `users/${userId}/notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), { read });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(userId: string, unreadIds: string[]): Promise<void> {
  if (unreadIds.length === 0) return;
  const path = `users/${userId}/notifications`;
  try {
    const batch = writeBatch(db);
    for (const id of unreadIds.slice(0, 200)) {
      batch.update(doc(db, 'users', userId, 'notifications', id), { read: true });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveIntegrationConfig(
  companyId: string,
  actor: ActorContext,
  config: Pick<IntegrationConfig, 'status' | 'allowedScopes' | 'requireConfirmationForDestructive'>
): Promise<void> {
  const path = `companies/${companyId}/integrations/chatgpt_mcp`;
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'companies', companyId, 'integrations', 'chatgpt_mcp'), {
      id: 'chatgpt_mcp',
      companyId,
      provider: 'chatgpt_mcp',
      status: config.status,
      allowedScopes: config.allowedScopes.slice(0, 20),
      requireConfirmationForDestructive: Boolean(config.requireConfirmationForDestructive),
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    appendAuditLogToBatch(
      batch,
      companyId,
      actor,
      `integration.${config.status}`,
      'integration',
      'chatgpt_mcp',
      `Set ChatGPT MCP integration status to "${config.status}"`
    );
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchPendingInvitationsForEmail(email: string): Promise<Invitation[]> {
  const path = 'invitations';
  try {
    const q = query(
      collection(db, 'invitations'),
      where('inviteeEmail', '==', email.toLowerCase()),
      where('status', '==', 'pending')
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as Invitation);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
