import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCompanyData } from '../contexts/CompanyDataContext';
import { createTask, updateTask } from '../lib/firestoreService';
import { TASK_PRIORITIES, TASK_STATUSES } from '../lib/validators';
import type { Task, TaskPriority, TaskStatus } from '../types/domain';

interface TaskFormModalProps {
  task?: Task | null;
  onClose: () => void;
  onSaved?: (taskId: string) => void;
}

export function TaskFormModal({ task, onClose, onSaved }: TaskFormModalProps) {
  const { activeCompanyId, company, members, departments, projects, can, actorContext } =
    useCompanyData();

  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [projectId, setProjectId] = useState(task?.projectId || '');
  const [departmentId, setDepartmentId] = useState(task?.departmentId || '');
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId || '');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'To Do');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'Medium');
  const [startDate, setStartDate] = useState(task?.startDate || '');
  const [deadline, setDeadline] = useState(task?.deadline || '');
  const [tagsRaw, setTagsRaw] = useState((task?.tags || []).join(', '));
  const [visitorVisible, setVisitorVisible] = useState(task?.visitorVisible || false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAssign = can('assignTasks');
  const activeMembers = members.filter((m) => m.status === 'active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !company || !actorContext) return;
    setError(null);
    setBusy(true);

    try {
      const selectedProj = projects.find((p) => p.id === projectId);
      const selectedDept = departments.find((d) => d.id === departmentId);
      const selectedAssignee = activeMembers.find((m) => m.userId === assigneeId);
      const tags = tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 10);

      if (task) {
        await updateTask(activeCompanyId, company.name, task, actorContext, {
          title,
          description,
          projectId: selectedProj?.id || '',
          projectName: selectedProj?.name || '',
          departmentId: selectedDept?.id || '',
          departmentName: selectedDept?.name || '',
          assigneeId: selectedAssignee?.userId || '',
          assigneeName: selectedAssignee?.displayName || '',
          status,
          priority,
          startDate,
          deadline,
          tags,
          visitorVisible,
        });
        onSaved?.(task.id);
      } else {
        const createdId = await createTask(activeCompanyId, company.name, actorContext, {
          title,
          description,
          projectId: selectedProj?.id || '',
          projectName: selectedProj?.name || '',
          departmentId: selectedDept?.id || '',
          departmentName: selectedDept?.name || '',
          assigneeId: selectedAssignee?.userId || '',
          assigneeName: selectedAssignee?.displayName || '',
          status,
          priority,
          startDate,
          deadline,
          tags,
          visitorVisible,
        });
        onSaved?.(createdId);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save task.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            {task ? 'Edit Task' : 'Create New Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close task form"
            className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Task title
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Finalize Q4 compliance audit checklist"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              maxLength={4000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Scope, deliverables, and acceptance criteria..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="">Unassigned department</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Project
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Responsible person
              </label>
              <select
                value={assigneeId}
                disabled={!canAssign}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900 disabled:bg-slate-50"
              >
                <option value="">Unassigned</option>
                {activeMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Deadline
              </label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Tags (comma separated, max 10)
            </label>
            <input
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="compliance, q4, security"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 pt-1">
            <input
              type="checkbox"
              checked={visitorVisible}
              onChange={(e) => setVisitorVisible(e.target.checked)}
              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
            />
            <span>Make visible to authorized company Visitors</span>
          </label>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
