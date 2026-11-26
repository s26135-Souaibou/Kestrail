import React, { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  KeyRound,
  Link2,
  Plus,
  Save,
  ShieldCheck,
  Unlink,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import { getCommonTimezones } from '../../lib/validators';

interface UserProfileViewProps {
  onOpenOnboarding: () => void;
}

export function UserProfileView({ onOpenOnboarding }: UserProfileViewProps) {
  const {
    firebaseUser,
    userProfile,
    updateOwnProfile,
    linkGoogleAccount,
    linkEmailPassword,
    unlinkProvider,
    changePassword,
    authError,
    clearAuthError,
  } = useAuth();
  const { memberships, activeCompanyId, switchCompany } = useCompanyData();

  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [jobTitle, setJobTitle] = useState(userProfile?.jobTitle || '');
  const [phone, setPhone] = useState(userProfile?.phone || '');
  const [timezone, setTimezone] = useState(userProfile?.timezone || 'UTC');

  const [linkPassword, setLinkPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const timezones = getCommonTimezones();
  const providers = firebaseUser?.providerData.map((p) => p.providerId) || [];
  const hasGoogle = providers.includes('google.com');
  const hasPassword = providers.includes('password');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setLocalError(null);
    try {
      await updateOwnProfile({ displayName, jobTitle, phone, timezone });
      setNotice('Profile preferences saved.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkGoogle = async () => {
    clearAuthError();
    setLocalError(null);
    setNotice(null);
    setBusy(true);
    try {
      await linkGoogleAccount();
      setNotice('Google Sign-In linked to your account.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to link Google.');
    } finally {
      setBusy(false);
    }
  };

  const handleLinkPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setNotice(null);
    setBusy(true);
    try {
      await linkEmailPassword(linkPassword);
      setLinkPassword('');
      setNotice('Email & password sign-in linked to your account.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to link password.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnlink = async (providerId: string) => {
    clearAuthError();
    setLocalError(null);
    setNotice(null);
    setBusy(true);
    try {
      await unlinkProvider(providerId);
      setNotice('Authentication provider unlinked.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to unlink provider.');
    } finally {
      setBusy(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearAuthError();
    setLocalError(null);
    setNotice(null);
    setBusy(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setNotice('Password updated successfully.');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Unable to update password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          User Profile &amp; Account Management
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage your profile details, linked authentication methods, and company memberships.
        </p>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {(localError || authError) && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {localError || authError}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Profile Form */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="font-display text-sm font-semibold text-slate-900 border-b border-slate-200 pb-3">
            Personal Details
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Account Email
            </label>
            <input
              type="email"
              disabled
              value={userProfile?.email || firebaseUser?.email || ''}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Full name
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Job title
              </label>
              <input
                type="text"
                maxLength={120}
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="Operations Lead"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Phone (optional)
              </label>
              <input
                type="text"
                maxLength={40}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Time zone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Profile
            </button>
          </div>
        </form>

        {/* Company Memberships */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4 h-fit">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Your Companies ({memberships.length})
            </h2>
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
            >
              <Plus className="w-3.5 h-3.5" />
              New / Join
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {memberships.map((m) => (
              <div key={m.companyId} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 truncate flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    {m.companyName}
                  </div>
                  <div className="text-[11px] text-slate-500">{m.role}</div>
                </div>
                {m.companyId === activeCompanyId ? (
                  <span className="text-[11px] font-medium text-emerald-700 shrink-0">
                    Active
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchCompany(m.companyId)}
                    className="px-2.5 py-1 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
                  >
                    Switch
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linked Sign-In Providers & Password Management */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-slate-700" />
              Connected Sign-In Methods
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Link Google Sign-In and Email/Password authentication to the same profile and company memberships.
            </p>
          </div>
          <span className="text-xs font-medium text-emerald-700">
            Email Verified
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Google Sign-In Link */}
          <div className="p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Google OAuth Sign-In
                </div>
                <div className="text-xs text-slate-500">
                  {hasGoogle ? 'Connected to your Google account' : 'Not connected'}
                </div>
              </div>
              {hasGoogle ? (
                <button
                  type="button"
                  disabled={busy || providers.length <= 1}
                  onClick={() => handleUnlink('google.com')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Unlink
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLinkGoogle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Link Google Account
                </button>
              )}
            </div>
          </div>

          {/* Email & Password Link / Change */}
          <div className="p-4 rounded-lg border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  Email &amp; Password Authentication
                </div>
                <div className="text-xs text-slate-500">
                  {hasPassword ? 'Password login enabled' : 'Not linked yet'}
                </div>
              </div>
              {hasPassword && (
                <button
                  type="button"
                  disabled={busy || providers.length <= 1}
                  onClick={() => handleUnlink('password')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  Unlink
                </button>
              )}
            </div>

            {!hasPassword ? (
              <form onSubmit={handleLinkPassword} className="flex gap-2 pt-1">
                <input
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  placeholder="Set password (min 6 chars)"
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Link Password
                </button>
              </form>
            ) : (
              <form onSubmit={handleChangePassword} className="grid sm:grid-cols-3 gap-2 pt-1">
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Update Password
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
