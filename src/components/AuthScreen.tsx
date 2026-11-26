import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getCommonTimezones } from '../lib/validators';

type AuthMode = 'login' | 'register' | 'reset';

export function AuthScreen() {
  const {
    firebaseUser,
    registerWithEmail,
    loginWithEmail,
    loginWithGoogle,
    resetPassword,
    resendVerificationEmail,
    reloadUser,
    logout,
    authError,
    clearAuthError,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  const timezones = getCommonTimezones();

  const switchMode = (next: AuthMode) => {
    clearAuthError();
    setFeedback(null);
    setMode(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'register') {
        await registerWithEmail(email, password, displayName, timezone);
        setFeedback('Verification email sent. Please verify your inbox to continue.');
      } else {
        await resetPassword(email);
        setFeedback('Password reset instructions have been sent to your email.');
      }
    } catch {
      // Error surfaced via authError
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setFeedback(null);
    setSubmitting(true);
    try {
      await loginWithGoogle();
    } catch {
      // Error surfaced via authError
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyRefresh = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      const verified = await reloadUser();
      if (!verified) {
        setFeedback('Email is still unverified. Click the link in your inbox, then refresh.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setSubmitting(true);
    setFeedback(null);
    try {
      await resendVerificationEmail();
      setFeedback('A new verification email has been sent.');
    } catch {
      // Error surfaced via authError
    } finally {
      setSubmitting(false);
    }
  };

  // Unverified email gate for newly registered email/password users
  if (firebaseUser && !firebaseUser.emailVerified) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-8">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-display text-lg font-semibold text-slate-900">
              Kestrel Workspace
            </span>
          </div>

          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Verify your email address
          </h1>
          <p className="text-sm text-slate-600 leading-relaxed mb-6">
            We sent a verification link to{' '}
            <span className="font-medium text-slate-900">{firebaseUser.email}</span>.
            Email verification is required before creating or accessing company workspaces.
          </p>

          {feedback && (
            <div className="mb-4 p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{feedback}</span>
            </div>
          )}

          {authError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleVerifyRefresh}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
              I verified my email — Continue
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Resend verification email
            </button>

            <button
              type="button"
              onClick={logout}
              className="w-full text-center text-xs font-medium text-slate-500 hover:text-slate-900 pt-2"
            >
              Sign out and use another account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-12 items-stretch">
      {/* Left Visual Column */}
      <div className="hidden lg:block lg:col-span-6 relative bg-slate-900 overflow-hidden">
        {!imageFailed ? (
          <img
            src="/src/assets/images/auth_workspace_studio_1795658863765.jpg"
            alt="Kestrel Workspace modern collaborative engineering and strategy studio"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
            <Building2 className="w-16 h-16 text-slate-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/20 flex flex-col justify-between p-10">
          <div className="flex items-center gap-2.5 text-white">
            <div className="w-8 h-8 rounded-lg bg-white text-slate-900 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-display text-lg font-semibold tracking-tight">
              Kestrel Workspace
            </span>
          </div>

          <div className="max-w-lg">
            <h2 className="font-display text-3xl font-semibold text-white leading-tight mb-4 [text-wrap:balance]">
              Structured task governance across every company and department.
            </h2>
            <p className="text-sm text-slate-200 leading-relaxed mb-6">
              Organize multi-company teams with role-based access control, scheduled subtasks,
              deadline timelines, and verifiable operational reports.
            </p>
            <div className="flex items-center gap-3 text-xs text-slate-300">
              <span>Multi-Company Isolation</span>
              <span aria-hidden="true">·</span>
              <span>Role-Based Permissions</span>
              <span aria-hidden="true">·</span>
              <span>Audit Trails</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Authentication Form */}
      <div className="lg:col-span-6 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <span className="font-display text-lg font-semibold text-slate-900">
              Kestrel Workspace
            </span>
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-semibold text-slate-900 mb-2">
              {mode === 'login' && 'Sign in to your workspace'}
              {mode === 'register' && 'Create your account'}
              {mode === 'reset' && 'Reset your password'}
            </h1>
            <p className="text-sm text-slate-600">
              {mode === 'login' && 'Access your companies, assigned deliverables, and reports.'}
              {mode === 'register' && 'Register to create a company or accept a team invitation.'}
              {mode === 'reset' && 'Enter your account email to receive a secure reset link.'}
            </p>
          </div>

          {authError && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5 leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{authError}</span>
            </div>
          )}

          {feedback && (
            <div className="mb-5 p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2.5 leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{feedback}</span>
            </div>
          )}

          {mode !== 'reset' && (
            <>
              <button
                type="button"
                onClick={handleGoogle}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-900 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-3 bg-slate-50 text-slate-500">or use email and password</span>
                </div>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
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
                  placeholder="Alex Morgan"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Work email
              </label>
              <input
                type="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('reset')}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  minLength={6}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>
            )}

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Time zone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:border-slate-900"
                >
                  {timezones.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {mode === 'login' && (
                <>
                  <span>Sign in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
              {mode === 'register' && (
                <>
                  <span>Create account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
              {mode === 'reset' && (
                <>
                  <KeyRound className="w-4 h-4" />
                  <span>Send reset link</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            {mode === 'login' && (
              <>
                <span>New to Kestrel Workspace?</span>
                <button
                  type="button"
                  onClick={() => switchMode('register')}
                  className="font-medium text-slate-900 hover:underline"
                >
                  Create an account
                </button>
              </>
            )}
            {mode === 'register' && (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-medium text-slate-900 hover:underline"
                >
                  Sign in instead
                </button>
              </>
            )}
            {mode === 'reset' && (
              <>
                <span>Remembered your password?</span>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="font-medium text-slate-900 hover:underline"
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
