import React, { useState } from 'react';
import { Building2, Check, KeyRound, LogOut, MailPlus, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyData } from '../contexts/CompanyDataContext';
import { acceptInvitationById, createCompanyWorkspace } from '../lib/firestoreService';
import { getCommonTimezones } from '../lib/validators';

interface CompanyOnboardingProps {
  onComplete?: () => void;
  allowCancel?: boolean;
  onCancel?: () => void;
}

export function CompanyOnboarding({
  onComplete,
  allowCancel = false,
  onCancel,
}: CompanyOnboardingProps) {
  const { userProfile, firebaseUser, logout } = useAuth();
  const { incomingInvitations } = useCompanyData();

  const [tab, setTab] = useState<'create' | 'join'>(
    incomingInvitations.length > 0 ? 'join' : 'create'
  );
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [timezone, setTimezone] = useState(
    userProfile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [seedDepts, setSeedDepts] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timezones = getCommonTimezones();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser || !userProfile) return;
    setError(null);
    setBusy(true);
    try {
      await createCompanyWorkspace(
        {
          uid: firebaseUser.uid,
          displayName: userProfile.displayName,
          email: userProfile.email,
        },
        userProfile,
        {
          name: companyName,
          industry,
          timezone,
          website,
          description,
          seedDefaultDepartments: seedDepts,
        }
      );
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create company workspace.');
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptInvite = async (invitationId: string) => {
    if (!userProfile) return;
    setError(null);
    setBusy(true);
    try {
      await acceptInvitationById(invitationId, userProfile);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept invitation.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-display text-lg font-semibold text-slate-900">
                Set up a company workspace
              </h1>
              <p className="text-xs text-slate-500">
                Signed in as {userProfile?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {allowCancel && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg"
              >
                Back to workspace
              </button>
            )}
            {!allowCancel && (
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            )}
          </div>
        </div>

        <div className="px-8 pt-6">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('create')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === 'create'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Create New Company
            </button>
            <button
              type="button"
              onClick={() => setTab('join')}
              className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                tab === 'join'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Join via Invitation ({incomingInvitations.length})
            </button>
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Company name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={120}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Northstar Logistics Inc."
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Industry
                  </label>
                  <input
                    type="text"
                    maxLength={80}
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="Software, Manufacturing, Finance..."
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Primary time zone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Company website (optional)
                  </label>
                  <input
                    type="url"
                    maxLength={300}
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Description (optional)
                </label>
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of company operations..."
                  className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-slate-700 pt-1">
                <input
                  type="checkbox"
                  checked={seedDepts}
                  onChange={(e) => setSeedDepts(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                />
                <span>Initialize default departments (Management, Operations, IT)</span>
              </label>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  {busy ? 'Creating workspace...' : 'Create Company Workspace'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 mb-3">
                  Pending invitations for {userProfile?.email}
                </h2>
                {incomingInvitations.length === 0 ? (
                  <div className="p-4 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600">
                    No pending invitations found for your email address. Ask your company
                    administrator for an invitation code below.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                    {incomingInvitations.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-4 flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {inv.companyName}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            Role: {inv.role} · Invited by {inv.invitedByName}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleAcceptInvite(inv.id)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Accept & Join
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Or enter an Invitation Code directly
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="inv_..."
                      className="w-full pl-9 pr-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={busy || !inviteCode.trim()}
                    onClick={() => handleAcceptInvite(inviteCode.trim())}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap shrink-0"
                  >
                    <MailPlus className="w-4 h-4" />
                    Join Company
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
