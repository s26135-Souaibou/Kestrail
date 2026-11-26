import React, { useState } from 'react';
import { Building, Edit3, Plus, Trash2, X } from 'lucide-react';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import { removeDepartment, saveDepartment } from '../../lib/firestoreService';
import type { Department } from '../../types/domain';

export function DepartmentsView() {
  const { activeCompanyId, departments, members, tasks, can, actorContext } = useCompanyData();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = can('manageDepartments');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setCode('');
    setDescription('');
    setManagerId('');
    setError(null);
    setShowModal(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setName(d.name);
    setCode(d.code);
    setDescription(d.description || '');
    setManagerId(d.managerId || '');
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !actorContext) return;
    setBusy(true);
    setError(null);
    try {
      const mgr = members.find((m) => m.userId === managerId);
      await saveDepartment(activeCompanyId, actorContext, {
        id: editing?.id,
        name,
        code,
        description,
        managerId: mgr?.userId || '',
        managerName: mgr?.displayName || '',
      });
      setShowModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save department.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (d: Department) => {
    if (!activeCompanyId || !actorContext) return;
    setBusy(true);
    try {
      await removeDepartment(activeCompanyId, d, actorContext);
    } finally {
      setBusy(false);
    }
  };

  const quickAddPreset = async (presetName: string, presetCode: string) => {
    if (!activeCompanyId || !actorContext || !canManage) return;
    setBusy(true);
    try {
      await saveDepartment(activeCompanyId, actorContext, {
        name: presetName,
        code: presetCode,
        description: `${presetName} department operations`,
      });
    } finally {
      setBusy(false);
    }
  };

  const commonPresets = [
    { name: 'Human Resources', code: 'HR' },
    { name: 'Finance', code: 'FIN' },
    { name: 'Marketing', code: 'MKT' },
    { name: 'Sales', code: 'SLS' },
  ].filter((p) => !departments.some((d) => d.name.toLowerCase() === p.name.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">Departments</h1>
          <p className="text-sm text-slate-600 mt-1">
            Structure teams into specialized units and track workload across each department.
          </p>
        </div>

        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Department
          </button>
        )}
      </div>

      {canManage && commonPresets.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-slate-500">Quick add standard unit:</span>
          {commonPresets.map((p) => (
            <button
              key={p.code}
              type="button"
              disabled={busy}
              onClick={() => quickAddPreset(p.name, p.code)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              + {p.name} ({p.code})
            </button>
          ))}
        </div>
      )}

      {departments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Building className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">No departments defined</p>
          <p className="text-xs text-slate-500">
            Create departments to assign team members and categorize company deliverables.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((d) => {
            const deptMembers = members.filter((m) => m.departmentIds.includes(d.id));
            const deptTasks = tasks.filter((t) => t.departmentId === d.id);
            const completed = deptTasks.filter((t) => t.status === 'Completed').length;

            return (
              <div
                key={d.id}
                className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-mono text-slate-500">{d.code}</div>
                    <h2 className="font-display text-base font-semibold text-slate-900">
                      {d.name}
                    </h2>
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(d)}
                        aria-label={`Edit ${d.name}`}
                        className="p-1.5 text-slate-400 hover:text-slate-900"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleDelete(d)}
                        aria-label={`Delete ${d.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed min-h-[32px]">
                  {d.description || 'No description provided.'}
                </p>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="block text-slate-400 text-[11px]">Manager</span>
                    <span className="font-medium text-slate-900 truncate block">
                      {d.managerName || 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[11px]">Members</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      {deptMembers.length}
                    </span>
                  </div>
                  <div>
                    <span className="block text-slate-400 text-[11px]">Tasks</span>
                    <span className="font-mono tabular-nums font-medium text-slate-900">
                      {completed}/{deptTasks.length}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-slate-900">
                {editing ? 'Edit Department' : 'Create Department'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Department name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Engineering"
                    className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="ENG"
                    className="w-full px-3.5 py-2 text-sm font-mono uppercase border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Department Manager
                </label>
                <select
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.displayName} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                >
                  {busy ? 'Saving...' : 'Save Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
