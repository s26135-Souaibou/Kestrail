import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  MailPlus,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import {
  createInvitation,
  removeCompanyMember,
  revokeInvitation,
  updateCompanyMember,
} from '../../lib/firestoreService';
import { ALL_ROLES, formatTimestamp } from '../../lib/validators';
import type { CompanyMember, RoleName } from '../../types/domain';

export function TeamMembersView() {
  const {
    activeCompanyId,
    company,
    members,
    departments,
    projects,
    sentInvitations,
    activeMember,
    can,
    actorContext,
  } = useCompanyData();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<RoleName, 'Super Administrator'>>('Employee');
  const [inviteDepts, setInviteDepts] = useState<string[]>([]);
  const [inviteProjects, setInviteProjects] = useState<string[]>([]);
  const [createdInviteId, setCreatedInviteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [editingMember, setEditingMember] = useState<CompanyMember | null>(null);
  const [editRole, setEditRole] = useState<RoleName>('Employee');
  const [editDepts, setEditDepts] = useState<string[]>([]);
  const [editProjects, setEditProjects] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [editJobTitle, setEditJobTitle] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageUsers = can('manageUsers');
  const canInviteUsers = can('inviteUsers');
  const canInviteVisitors = can('inviteVisitors');

  const invitableRoles: Exclude<RoleName, 'Super Administrator'>[] = [
    ...(canInviteUsers
      ? ([
          'Company Administrator',
          'Department Manager',
          'Team Leader',
          'Employee',
        ] as const)
      : []),
    ...(canInviteVisitors ? (['Visitor'] as const) : []),
  ];

  const openInvite = () => {
    setInviteEmail('');
    setInviteRole(invitableRoles[invitableRoles.length - 1] || 'Employee');
    setInviteDepts([]);
    setInviteProjects([]);
    setCreatedInviteId(null);
    setError(null);
    setShowInviteModal(true);
  };

  const openEditMember = (m: CompanyMember) => {
    setEditingMember(m);
    setEditRole(m.role);
    setEditDepts(m.departmentIds || []);
    setEditProjects(m.allowedProjectIds || []);
    setEditStatus(m.status);
    setEditJobTitle(m.jobTitle || '');
    setError(null);
  };

  const toggleItem = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !company || !actorContext) return;
    setBusy(true);
    setError(null);
    try {
      const id = await createInvitation(activeCompanyId, company.name, actorContext, {
        inviteeEmail: inviteEmail,
        role: inviteRole,
        departmentIds: inviteDepts,
        allowedProjectIds: inviteRole === 'Visitor' ? inviteProjects : [],
      });
      setCreatedInviteId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create invitation.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !company || !editingMember || !actorContext) return;
    setBusy(true);
    setError(null);
    try {
      await updateCompanyMember(
        activeCompanyId,
        company.name,
        editingMember,
        {
          role: editRole,
          departmentIds: editDepts,
          allowedProjectIds: editRole === 'Visitor' ? editProjects : [],
          status: editStatus,
          jobTitle: editJobTitle,
        },
        actorContext
      );
      setEditingMember(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update member.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMember = async (m: CompanyMember) => {
    if (!activeCompanyId || !actorContext) return;
    setBusy(true);
    setError(null);
    try {
      await removeCompanyMember(activeCompanyId, m, actorContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to remove member.');
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Team Members &amp; Visitor Access
          </h1>
          <p className="text-sm text-slate-600 mt-1 tabular-nums">
            {members.length} active or suspended members in {company?.name}
          </p>
        </div>

        {(canInviteUsers || canInviteVisitors) && (
          <button
            type="button"
            onClick={openInvite}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member or Visitor
          </button>
        )}
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500 bg-slate-50">
                <th className="py-3 px-5">Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Departments</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Joined</th>
                {canManageUsers && <th className="py-3 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {members.map((m) => {
                const deptNames = m.departmentIds
                  .map((id) => departments.find((d) => d.id === id)?.name)
                  .filter(Boolean);
                const isOwner = m.userId === company?.ownerId;

                return (
                  <tr key={m.userId} className="hover:bg-slate-50">
                    <td className="py-3.5 px-5">
                      <div className="font-medium text-slate-900">
                        {m.displayName}
                        {m.userId === activeMember?.userId ? ' (You)' : ''}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {m.email}
                        {m.jobTitle ? ` · ${m.jobTitle}` : ''}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {m.role}
                      {m.role === 'Visitor' && (
                        <div className="text-[11px] text-slate-500">
                          {m.allowedProjectIds.length} scoped project(s)
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {deptNames.length > 0 ? deptNames.join(' · ') : 'Unassigned'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-medium ${
                          m.status === 'active' ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {m.status === 'active' ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                      {formatTimestamp(m.joinedAt, company?.timezone)}
                    </td>
                    {canManageUsers && (
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditMember(m)}
                            aria-label={`Edit ${m.displayName}`}
                            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          {!isOwner && m.userId !== activeMember?.userId && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleRemoveMember(m)}
                              aria-label={`Remove ${m.displayName}`}
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sent Invitations */}
      {(canInviteUsers || canInviteVisitors) && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <MailPlus className="w-4 h-4 text-slate-500" />
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Invitations Issued by You
            </h2>
          </div>

          {sentInvitations.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No invitations issued yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sentInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-medium text-slate-900">{inv.inviteeEmail}</div>
                    <div className="text-slate-500 mt-0.5">
                      Role: {inv.role} · Status:{' '}
                      <span className="capitalize font-medium text-slate-800">{inv.status}</span>
                      {' · '}Code: <span className="font-mono">{inv.id}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {inv.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() => copyCode(inv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                          {copiedId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy Code
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => actorContext && revokeInvitation(inv, actorContext)}
                          className="px-3 py-1.5 text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                        >
                          Revoke
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Invite Team Member or Visitor
              </h2>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {createdInviteId ? (
              <div className="p-6 space-y-4">
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-2">
                  <div className="font-semibold">Invitation created for {inviteEmail}</div>
                  <p>
                    When {inviteEmail} signs in with Google or verified email, this invitation will
                    appear automatically in their onboarding and Notifications screens. You can also
                    share this invitation code:
                  </p>
                  <div className="font-mono bg-white border border-emerald-200 rounded px-3 py-2 flex items-center justify-between">
                    <span>{createdInviteId}</span>
                    <button
                      type="button"
                      onClick={() => copyCode(createdInviteId)}
                      className="text-slate-700 hover:text-slate-900 font-sans font-medium"
                    >
                      {copiedId === createdInviteId ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="p-6 overflow-y-auto space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Invitee email address
                  </label>
                  <input
                    type="email"
                    required
                    maxLength={254}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Assigned role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(e.target.value as Exclude<RoleName, 'Super Administrator'>)
                    }
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                  >
                    {invitableRoles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {departments.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Assign departments
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {departments.map((d) => (
                        <label
                          key={d.id}
                          className="flex items-center gap-2 text-xs text-slate-700 p-2 border border-slate-200 rounded-lg"
                        >
                          <input
                            type="checkbox"
                            checked={inviteDepts.includes(d.id)}
                            onChange={() => toggleItem(inviteDepts, d.id, setInviteDepts)}
                          />
                          <span className="truncate">{d.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {inviteRole === 'Visitor' && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1.5">
                      Allowed projects for Visitor (strictly scoped)
                    </label>
                    {projects.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No projects available yet. Visitors will only see explicitly marked
                        visitor-visible tasks.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2.5">
                        {projects.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                            <input
                              type="checkbox"
                              checked={inviteProjects.includes(p.id)}
                              onChange={() =>
                                toggleItem(inviteProjects, p.id, setInviteProjects)
                              }
                            />
                            <span>{p.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? 'Creating...' : 'Create Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Manage Member: {editingMember.displayName}
              </h2>
              <button
                type="button"
                onClick={() => setEditingMember(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveMember} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Role
                  </label>
                  <select
                    value={editRole}
                    disabled={editingMember.userId === company?.ownerId}
                    onChange={(e) => setEditRole(e.target.value as RoleName)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Membership Status
                  </label>
                  <select
                    value={editStatus}
                    disabled={editingMember.userId === company?.ownerId}
                    onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended')}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Job title
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={editJobTitle}
                  onChange={(e) => setEditJobTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              {departments.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Departments
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {departments.map((d) => (
                      <label
                        key={d.id}
                        className="flex items-center gap-2 text-xs text-slate-700 p-2 border border-slate-200 rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={editDepts.includes(d.id)}
                          onChange={() => toggleItem(editDepts, d.id, setEditDepts)}
                        />
                        <span className="truncate">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {editRole === 'Visitor' && projects.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Allowed Visitor Projects
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2.5">
                    {projects.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={editProjects.includes(p.id)}
                          onChange={() => toggleItem(editProjects, p.id, setEditProjects)}
                        />
                        <span>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
