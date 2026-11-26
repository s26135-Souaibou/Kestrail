import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { updateActiveCompanyId, type ActorContext } from '../lib/firestoreService';
import { DEFAULT_ROLE_POLICIES, roleToDocId, toMillis } from '../lib/validators';
import { useAuth } from './AuthContext';
import type {
  AuditLogEntry,
  Company,
  CompanyMember,
  CompanyRole,
  Department,
  IntegrationConfig,
  Invitation,
  NotificationItem,
  PermissionKey,
  Project,
  Report,
  RolePermissions,
  Task,
  UserMembership,
} from '../types/domain';

interface CompanyDataContextValue {
  memberships: UserMembership[];
  membershipsLoaded: boolean;
  activeCompanyId: string;
  switchCompany: (companyId: string) => Promise<void>;
  company: Company | null;
  companyLoading: boolean;
  activeMember: CompanyMember | null;
  roles: CompanyRole[];
  members: CompanyMember[];
  departments: Department[];
  projects: Project[];
  tasks: Task[];
  reports: Report[];
  sentInvitations: Invitation[];
  incomingInvitations: Invitation[];
  notifications: NotificationItem[];
  auditLogs: AuditLogEntry[];
  integrationConfig: IntegrationConfig | null;
  unreadNotificationCount: number;
  activePermissions: RolePermissions;
  can: (permission: PermissionKey) => boolean;
  actorContext: ActorContext | null;
}

const CompanyDataContext = createContext<CompanyDataContextValue | null>(null);

export function CompanyDataProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, userProfile } = useAuth();
  const uid = firebaseUser?.uid || '';
  const email = (firebaseUser?.email || '').toLowerCase();
  const isVerified = Boolean(firebaseUser?.emailVerified);

  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [membershipsLoaded, setMembershipsLoaded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [incomingInvitations, setIncomingInvitations] = useState<Invitation[]>([]);

  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [sentInvitations, setSentInvitations] = useState<Invitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [integrationConfig, setIntegrationConfig] = useState<IntegrationConfig | null>(null);

  // User-level listeners (memberships, notifications, incoming invitations)
  useEffect(() => {
    if (!uid || !isVerified) {
      setMemberships([]);
      setMembershipsLoaded(false);
      setNotifications([]);
      setIncomingInvitations([]);
      return;
    }

    const unsubMemberships = onSnapshot(
      collection(db, 'users', uid, 'memberships'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as UserMembership)
          .filter((m) => m.status === 'active');
        setMemberships(list);
        setMembershipsLoaded(true);
      },
      (err) => {
        setMembershipsLoaded(true);
        handleFirestoreError(err, OperationType.LIST, `users/${uid}/memberships`);
      }
    );

    const unsubNotifications = onSnapshot(
      collection(db, 'users', uid, 'notifications'),
      (snap) => {
        const list = snap.docs
          .map((d) => d.data() as NotificationItem)
          .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `users/${uid}/notifications`)
    );

    let unsubInvites = () => {};
    if (email) {
      const invQ = query(
        collection(db, 'invitations'),
        where('inviteeEmail', '==', email),
        where('status', '==', 'pending')
      );
      unsubInvites = onSnapshot(
        invQ,
        (snap) => {
          setIncomingInvitations(snap.docs.map((d) => d.data() as Invitation));
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'invitations')
      );
    }

    return () => {
      unsubMemberships();
      unsubNotifications();
      unsubInvites();
    };
  }, [uid, email, isVerified]);

  const activeCompanyId = useMemo(() => {
    if (!memberships.length) return '';
    const preferred = userProfile?.activeCompanyId;
    if (preferred && memberships.some((m) => m.companyId === preferred)) {
      return preferred;
    }
    return memberships[0].companyId;
  }, [memberships, userProfile?.activeCompanyId]);

  const switchCompany = async (companyId: string) => {
    if (!uid || !memberships.some((m) => m.companyId === companyId)) return;
    await updateActiveCompanyId(uid, companyId);
  };

  // Company-level base listeners (company doc, members, roles, departments)
  useEffect(() => {
    if (!uid || !isVerified || !activeCompanyId) {
      setCompany(null);
      setRoles([]);
      setMembers([]);
      setDepartments([]);
      setCompanyLoading(false);
      return;
    }

    setCompanyLoading(true);
    const cid = activeCompanyId;

    const unsubCompany = onSnapshot(
      doc(db, 'companies', cid),
      (snap) => {
        setCompany(snap.exists() ? (snap.data() as Company) : null);
        setCompanyLoading(false);
      },
      (err) => {
        setCompanyLoading(false);
        handleFirestoreError(err, OperationType.GET, `companies/${cid}`);
      }
    );

    const unsubRoles = onSnapshot(
      collection(db, 'companies', cid, 'roles'),
      (snap) => {
        setRoles(snap.docs.map((d) => d.data() as CompanyRole));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `companies/${cid}/roles`)
    );

    const unsubMembers = onSnapshot(
      collection(db, 'companies', cid, 'members'),
      (snap) => {
        setMembers(snap.docs.map((d) => d.data() as CompanyMember));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `companies/${cid}/members`)
    );

    const unsubDepts = onSnapshot(
      collection(db, 'companies', cid, 'departments'),
      (snap) => {
        setDepartments(
          snap.docs
            .map((d) => d.data() as Department)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `companies/${cid}/departments`)
    );

    return () => {
      unsubCompany();
      unsubRoles();
      unsubMembers();
      unsubDepts();
    };
  }, [uid, isVerified, activeCompanyId]);

  const activeMember = useMemo(() => {
    if (!uid || !members.length) return null;
    return members.find((m) => m.userId === uid) || null;
  }, [members, uid]);

  const activePermissions = useMemo<RolePermissions>(() => {
    const roleName = activeMember?.role || 'Visitor';
    if (company?.ownerId === uid) {
      return DEFAULT_ROLE_POLICIES['Super Administrator'].permissions;
    }
    const roleDoc = roles.find((r) => r.id === roleToDocId(roleName) || r.name === roleName);
    if (roleDoc?.permissions) {
      return roleDoc.permissions;
    }
    return DEFAULT_ROLE_POLICIES[roleName].permissions;
  }, [activeMember?.role, company?.ownerId, roles, uid]);

  const can = (permission: PermissionKey): boolean => {
    if (!activeMember || activeMember.status !== 'active') return false;
    if (company?.ownerId === uid || activeMember.role === 'Super Administrator') return true;
    return Boolean(activePermissions[permission]);
  };

  // Permission-scoped company subcollection listeners (projects, tasks, reports, auditLogs, integrations)
  useEffect(() => {
    if (!uid || !isVerified || !activeCompanyId || !activeMember) {
      setProjects([]);
      setTasks([]);
      setReports([]);
      setSentInvitations([]);
      setAuditLogs([]);
      setIntegrationConfig(null);
      return;
    }

    const cid = activeCompanyId;
    const isVisitorRole = activeMember.role === 'Visitor';
    const isAdminOrOwner =
      company?.ownerId === uid ||
      activeMember.role === 'Super Administrator' ||
      activeMember.role === 'Company Administrator';

    // Projects
    const projQuery = isVisitorRole
      ? query(collection(db, 'companies', cid, 'projects'), where('visitorAccessible', '==', true))
      : collection(db, 'companies', cid, 'projects');

    const unsubProjects = onSnapshot(
      projQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as Project);
        if (isVisitorRole && activeMember.allowedProjectIds.length > 0) {
          setProjects(
            list.filter(
              (p) => p.visitorAccessible || activeMember.allowedProjectIds.includes(p.id)
            )
          );
        } else {
          setProjects(list.sort((a, b) => a.name.localeCompare(b.name)));
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `companies/${cid}/projects`)
    );

    // Tasks
    const tasksQuery = isVisitorRole
      ? query(collection(db, 'companies', cid, 'tasks'), where('visitorVisible', '==', true))
      : collection(db, 'companies', cid, 'tasks');

    const unsubTasks = onSnapshot(
      tasksQuery,
      (snap) => {
        let list = snap.docs.map((d) => d.data() as Task);
        if (isVisitorRole && activeMember.allowedProjectIds.length > 0) {
          list = list.filter(
            (t) =>
              t.visitorVisible &&
              (!t.projectId || activeMember.allowedProjectIds.includes(t.projectId))
          );
        }
        setTasks(list.sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt)));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `companies/${cid}/tasks`)
    );

    // Reports (scoped by viewAllReports permission)
    const canViewAllReports =
      isAdminOrOwner || Boolean(activePermissions.viewAllReports);
    const reportsQuery = canViewAllReports
      ? collection(db, 'companies', cid, 'reports')
      : query(collection(db, 'companies', cid, 'reports'), where('authorId', '==', uid));

    const unsubReports = onSnapshot(
      reportsQuery,
      (snap) => {
        setReports(
          snap.docs
            .map((d) => d.data() as Report)
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `companies/${cid}/reports`)
    );

    // Sent invitations by caller
    const invQ = query(
      collection(db, 'invitations'),
      where('invitedBy', '==', uid)
    );
    const unsubSentInvites = onSnapshot(
      invQ,
      (snap) => {
        setSentInvitations(
          snap.docs
            .map((d) => d.data() as Invitation)
            .filter((i) => i.companyId === cid)
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'invitations')
    );

    // Audit Logs (only if permitted)
    const canViewLogs = isAdminOrOwner || Boolean(activePermissions.viewAuditLogs);
    let unsubAudit = () => {};
    if (canViewLogs) {
      unsubAudit = onSnapshot(
        collection(db, 'companies', cid, 'auditLogs'),
        (snap) => {
          setAuditLogs(
            snap.docs
              .map((d) => d.data() as AuditLogEntry)
              .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, `companies/${cid}/auditLogs`)
      );
    } else {
      setAuditLogs([]);
    }

    // Integration Config (only if company admin)
    let unsubIntegration = () => {};
    if (isAdminOrOwner) {
      unsubIntegration = onSnapshot(
        doc(db, 'companies', cid, 'integrations', 'chatgpt_mcp'),
        (snap) => {
          setIntegrationConfig(snap.exists() ? (snap.data() as IntegrationConfig) : null);
        },
        (err) =>
          handleFirestoreError(err, OperationType.GET, `companies/${cid}/integrations/chatgpt_mcp`)
      );
    } else {
      setIntegrationConfig(null);
    }

    return () => {
      unsubProjects();
      unsubTasks();
      unsubReports();
      unsubSentInvites();
      unsubAudit();
      unsubIntegration();
    };
  }, [uid, isVerified, activeCompanyId, activeMember, company?.ownerId, activePermissions.viewAllReports, activePermissions.viewAuditLogs]);

  const unreadNotificationCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const actorContext = useMemo<ActorContext | null>(() => {
    if (!uid || !userProfile) return null;
    return {
      uid,
      displayName: userProfile.displayName || userProfile.email,
      email: userProfile.email,
      role: activeMember?.role,
      companyName: company?.name,
    };
  }, [uid, userProfile, activeMember?.role, company?.name]);

  return (
    <CompanyDataContext.Provider
      value={{
        memberships,
        membershipsLoaded,
        activeCompanyId,
        switchCompany,
        company,
        companyLoading,
        activeMember,
        roles,
        members,
        departments,
        projects,
        tasks,
        reports,
        sentInvitations,
        incomingInvitations,
        notifications,
        auditLogs,
        integrationConfig,
        unreadNotificationCount,
        activePermissions,
        can,
        actorContext,
      }}
    >
      {children}
    </CompanyDataContext.Provider>
  );
}

export function useCompanyData(): CompanyDataContextValue {
  const ctx = useContext(CompanyDataContext);
  if (!ctx) throw new Error('useCompanyData must be used within CompanyDataProvider');
  return ctx;
}
