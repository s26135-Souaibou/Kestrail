import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useCompanyData } from '../contexts/CompanyDataContext';
import { saveReport } from '../lib/firestoreService';
import type { Report, Task } from '../types/domain';

interface ReportFormModalProps {
  initialTask?: Task | null;
  report?: Report | null;
  onClose: () => void;
}

export function ReportFormModal({ initialTask, report, onClose }: ReportFormModalProps) {
  const { activeCompanyId, tasks, departments, members, actorContext } = useCompanyData();

  const [title, setTitle] = useState(
    report?.title || (initialTask ? `Completion Report: ${initialTask.title}` : '')
  );
  const [taskId, setTaskId] = useState(report?.taskId || initialTask?.id || '');
  const [departmentId, setDepartmentId] = useState(
    report?.departmentId || initialTask?.departmentId || ''
  );
  const [responsibleUserId, setResponsibleUserId] = useState(
    report?.responsibleUserId || initialTask?.assigneeId || actorContext?.uid || ''
  );
  const [taskCompletedAt, setTaskCompletedAt] = useState(
    report?.taskCompletedAt ||
      initialTask?.completedAt ||
      new Date().toISOString().slice(0, 10)
  );
  const [description, setDescription] = useState(report?.description || '');
  const [results, setResults] = useState(report?.results || '');
  const [observations, setObservations] = useState(report?.observations || '');
  const [attachmentsRaw, setAttachmentsRaw] = useState(
    (report?.attachmentLinks || []).join('\n')
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTaskSelect = (selectedId: string) => {
    setTaskId(selectedId);
    const t = tasks.find((item) => item.id === selectedId);
    if (t) {
      if (!title) setTitle(`Completion Report: ${t.title}`);
      if (t.departmentId) setDepartmentId(t.departmentId);
      if (t.assigneeId) setResponsibleUserId(t.assigneeId);
      if (t.completedAt) setTaskCompletedAt(t.completedAt);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCompanyId || !actorContext) return;
    setError(null);
    setBusy(true);

    try {
      const selectedTask = tasks.find((t) => t.id === taskId);
      const selectedDept = departments.find((d) => d.id === departmentId);
      const selectedUser = members.find((m) => m.userId === responsibleUserId);
      const attachmentLinks = attachmentsRaw
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 5);

      await saveReport(activeCompanyId, actorContext, {
        id: report?.id,
        title,
        description,
        taskId: selectedTask?.id || '',
        taskTitle: selectedTask?.title || '',
        departmentId: selectedDept?.id || '',
        departmentName: selectedDept?.name || '',
        responsibleUserId: selectedUser?.userId || actorContext.uid,
        responsibleUserName: selectedUser?.displayName || actorContext.displayName,
        taskCompletedAt,
        results,
        observations,
        attachmentLinks,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save report.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-display text-base font-semibold text-slate-900">
            {report ? 'Edit Operational Report' : 'Submit Task Completion Report'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close report form"
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
              Report title
            </label>
            <input
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Q4 Infrastructure Audit Results"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Related task
              </label>
              <select
                value={taskId}
                onChange={(e) => handleTaskSelect(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="">General operational report</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Department
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                <option value="">Company-wide</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Responsible user
              </label>
              <select
                value={responsibleUserId}
                onChange={(e) => setResponsibleUserId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Completion date
              </label>
              <input
                type="date"
                value={taskCompletedAt}
                onChange={(e) => setTaskCompletedAt(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Executive summary / description
            </label>
            <textarea
              rows={2}
              maxLength={3000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Overview of task objectives and execution context..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Results & deliverables
            </label>
            <textarea
              rows={3}
              required
              maxLength={4000}
              value={results}
              onChange={(e) => setResults(e.target.value)}
              placeholder="Concrete outcomes achieved, metrics, and completion evidence..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Observations & next steps
            </label>
            <textarea
              rows={2}
              maxLength={3000}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Risks identified, blockers resolved, or follow-up recommendations..."
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Attachment URLs (one https:// link per line, max 5)
            </label>
            <textarea
              rows={2}
              value={attachmentsRaw}
              onChange={(e) => setAttachmentsRaw(e.target.value)}
              placeholder="https://drive.google.com/..."
              className="w-full px-3.5 py-2 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
            />
          </div>

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
              {busy ? 'Saving...' : report ? 'Update Report' : 'Publish Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
