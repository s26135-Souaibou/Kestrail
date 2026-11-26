import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  History,
  Save,
  Settings,
  Shield,
} from 'lucide-react';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import {
  saveIntegrationConfig,
  updateCompanyInfo,
  updateRolePermissions,
} from '../../lib/firestoreService';
import {
  ALL_ROLES,
  DEFAULT_ROLE_POLICIES,
  formatTimestamp,
  getCommonTimezones,
  PERMISSION_LABELS,
  roleToDocId,
} from '../../lib/validators';
import type { PermissionKey, RoleName, RolePermissions } from '../../types/domain';

type SettingsTab = 'general' | 'roles' | 'audit' | 'integrations';

interface McpManifestResponse {
  protocol: string;
  configured: boolean;
  status: string;
  oauthRequirements: {
    flow: string;
    tokenValidation: string;
    requiredEnvVars: string[];
    securityRules: string[];
  };
  tools: {
    name: string;
    description: string;
    requiresConfirmation: boolean;
    requiredPermission: string;
  }[];
}

export function CompanySettingsView() {
  const {
    activeCompanyId,
    company,
    roles,
    auditLogs,
    integrationConfig,
    can,
    actorContext,
  } = useCompanyData();

  const [tab, setTab] = useState<SettingsTab>('general');
  const [name, setName] = useState(company?.name || '');
  const [industry, setIndustry] = useState(company?.industry || '');
  const [timezone, setTimezone] = useState(company?.timezone || 'UTC');
  const [website, setWebsite] = useState(company?.website || '');
  const [description, setDescription] = useState(company?.description || '');
  const [selectedRole, setSelectedRole] = useState<RoleName>('Department Manager');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mcpManifest, setMcpManifest] = useState<McpManifestResponse | null>(null);

  useEffect(() => {
    if (company) {
      setName(company.name);
      setIndustry(company.industry || '');
      setTimezone(company.timezone || 'UTC');
      setWebsite(company.website || '');
      setDescription(company.description || '');
    }
  }, [company]);

  useEffect(() => {
    if (tab === 'integrations' && !mcpManifest) {
      void fetch('/api/mcp/manifest')
        .then((r) => r.json())
        .then((data) => setMcpManifest(data as McpManifestResponse))
        .catch(() => {});
    }
  }, [tab, mcpManifest]);

  const canManageCompany = can('manageCompany');
  const canManageRoles = can('manageRoles');
  const canViewAudit = can('viewAuditLogs');
  const timezones = getCommonTimezones();

  const currentRoleDoc = roles.find(
    (r) => r.id === roleToDocId(selectedRole) || r.name === selectedRole
  );
  const currentRolePerms: RolePermissions =
    currentRoleDoc?.permissions || DEFAULT_ROLE_POLICIES[selectedRole].permissions;

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !actorContext) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await updateCompanyInfo(activeCompanyId, actorContext, {
        name,
        industry,
        timezone,
        website,
        description,
      });
      setNotice('Company settings saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save settings.');
    } finally {
      setBusy(false);
    }
  };

  const handleTogglePermission = async (permKey: PermissionKey) => {
    if (!activeCompanyId || !actorContext || !canManageRoles) return;
    if (selectedRole === 'Super Administrator') return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated: RolePermissions = {
        ...currentRolePerms,
        [permKey]: !currentRolePerms[permKey],
      };
      await updateRolePermissions(activeCompanyId, selectedRole, updated, actorContext);
      setNotice(`Updated permissions for ${selectedRole}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update role permissions.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRevocation = async (nextStatus: 'unconfigured' | 'revoked') => {
    if (!activeCompanyId || !actorContext || !canManageCompany) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveIntegrationConfig(activeCompanyId, actorContext, {
        status: nextStatus,
        allowedScopes: integrationConfig?.allowedScopes || ['tasks:read', 'tasks:write'],
        requireConfirmationForDestructive:
          integrationConfig?.requireConfirmationForDestructive ?? true,
      });
      setNotice(
        nextStatus === 'revoked'
          ? 'External MCP connections marked revoked for this company.'
          : 'MCP integration state reset to unconfigured.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update integration config.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-slate-900">
          Company Settings &amp; Governance
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Configure workspace details, role-based access control policies, audit logs, and external integration readiness.
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-6 text-xs font-medium overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('general')}
          className={`py-3 border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            tab === 'general'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          Company Profile
        </button>

        <button
          type="button"
          onClick={() => setTab('roles')}
          className={`py-3 border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            tab === 'roles'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Roles &amp; Permissions
        </button>

        {canViewAudit && (
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={`py-3 border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              tab === 'audit'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            Audit Logs ({auditLogs.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => setTab('integrations')}
          className={`py-3 border-b-2 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            tab === 'integrations'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          API &amp; ChatGPT MCP
        </button>
      </div>

      {notice && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {tab === 'general' && (
        <form
          onSubmit={handleSaveCompany}
          className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Company name
              </label>
              <input
                type="text"
                required
                disabled={!canManageCompany}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Industry
              </label>
              <input
                type="text"
                disabled={!canManageCompany}
                maxLength={80}
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Company time zone
              </label>
              <select
                value={timezone}
                disabled={!canManageCompany}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
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
                Website
              </label>
              <input
                type="url"
                disabled={!canManageCompany}
                maxLength={300}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://company.com"
                className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              disabled={!canManageCompany}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
            />
          </div>

          <div className="text-xs text-slate-500 font-mono">
            Company Tenant ID: {company?.id} · Slug: {company?.slug}
          </div>

          {canManageCompany && (
            <div className="pt-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {busy ? 'Saving...' : 'Save Company Profile'}
              </button>
            </div>
          )}
        </form>
      )}

      {tab === 'roles' && (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 h-fit">
            {ALL_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`w-full px-5 py-3.5 text-left transition-colors ${
                  selectedRole === r ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-medium">{r}</div>
                <div
                  className={`text-xs mt-0.5 ${
                    selectedRole === r ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {DEFAULT_ROLE_POLICIES[r].description}
                </div>
              </button>
            ))}
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  {selectedRole} Permissions
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enforced on Firestore security rules for every protected operation.
                </p>
              </div>
              {selectedRole === 'Super Administrator' && (
                <span className="text-xs font-medium text-slate-500">Locked Full Access</span>
              )}
            </div>

            <div className="divide-y divide-slate-100">
              {PERMISSION_LABELS.map(({ key, label, description: desc }) => {
                const enabled = currentRolePerms[key];
                const disabled =
                  !canManageRoles || selectedRole === 'Super Administrator' || busy;
                return (
                  <label
                    key={key}
                    className="py-3 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div>
                      <div className="text-xs font-medium text-slate-900">{label}</div>
                      <div className="text-xs text-slate-500">{desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={disabled}
                      onChange={() => handleTogglePermission(key)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 disabled:opacity-50"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === 'audit' && canViewAudit && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Immutable Security &amp; Activity Audit Trail
            </h2>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {auditLogs.length} events
            </span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No audit events recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500 bg-slate-50">
                    <th className="py-2.5 px-5">Timestamp</th>
                    <th className="py-2.5 px-4">Actor</th>
                    <th className="py-2.5 px-4">Action</th>
                    <th className="py-2.5 px-4">Summary</th>
                    <th className="py-2.5 px-5 text-right">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {formatTimestamp(log.createdAt, company?.timezone)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{log.actorName}</div>
                        <div className="text-[11px] text-slate-500">{log.actorRole}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{log.action}</td>
                      <td className="py-3 px-4 text-slate-700">{log.summary}</td>
                      <td className="py-3 px-5 text-right font-mono text-slate-500">
                        {log.source}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'integrations' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Future ChatGPT / MCP Integration Architecture
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Current environment status:{' '}
                  <span className="font-mono font-semibold text-amber-700">
                    {integrationConfig?.status === 'revoked'
                      ? 'Revoked by Company Admin'
                      : mcpManifest?.configured
                        ? 'Server OAuth Ready'
                        : 'Unconfigured (Requires External OAuth Setup)'}
                  </span>
                </p>
              </div>

              {canManageCompany && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggleRevocation('revoked')}
                    className="px-3 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    Revoke External Access
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleToggleRevocation('unconfigured')}
                    className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Reset State
                  </button>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="font-semibold text-slate-900">
                  Required Server Configuration
                </div>
                <ul className="space-y-1 text-slate-600 list-disc pl-4">
                  <li>OAuth 2.1 + PKCE client registration (MCP_OAUTH_CLIENT_ID / SECRET)</li>
                  <li>Firebase ID Token verification via server endpoint /api/mcp/tools/:toolName</li>
                  <li>User-owned GCP project with Firebase Admin IAM role for server-side writes</li>
                  <li>Explicit confirmation required for report publishing &amp; destructive actions</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="font-semibold text-slate-900">API Endpoints</div>
                <div className="font-mono text-[11px] text-slate-700 space-y-1">
                  <div>GET /api/health — Service readiness</div>
                  <div>GET /api/auth/session — Server token check</div>
                  <div>GET /api/docs — OpenAPI 3.1 specification</div>
                  <div>GET /api/mcp/manifest — Prepared MCP tool schemas</div>
                  <div>POST /api/mcp/tools/:toolName — Authenticated MCP gateway</div>
                </div>
              </div>
            </div>
          </div>

          {mcpManifest && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Prepared MCP Tool Contracts ({mcpManifest.tools.length})
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500 bg-slate-50">
                      <th className="py-2.5 px-5">Tool Name</th>
                      <th className="py-2.5 px-4">Required Permission</th>
                      <th className="py-2.5 px-4">Confirmation</th>
                      <th className="py-2.5 px-5">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {mcpManifest.tools.map((tool) => (
                      <tr key={tool.name}>
                        <td className="py-3 px-5 font-mono font-medium text-slate-900">
                          {tool.name}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {tool.requiredPermission}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {tool.requiresConfirmation ? 'Required' : 'Standard'}
                        </td>
                        <td className="py-3 px-5 text-slate-600">{tool.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
