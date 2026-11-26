import { useMemo, useState } from 'react';
import {
  Edit3,
  ExternalLink,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import { removeReport } from '../../lib/firestoreService';
import { formatDateOnly, formatTimestamp } from '../../lib/validators';
import type { Report } from '../../types/domain';

interface ReportsViewProps {
  onCreateReport: () => void;
  onEditReport: (report: Report) => void;
}

export function ReportsView({ onCreateReport, onEditReport }: ReportsViewProps) {
  const { activeCompanyId, company, reports, departments, activeMember, can, actorContext } =
    useCompanyData();

  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);

  const canCreate = can('createReports');
  const isAdmin =
    activeMember?.role === 'Super Administrator' ||
    activeMember?.role === 'Company Administrator';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (deptFilter !== 'All' && r.departmentId !== deptFilter) return false;
      if (q) {
        const hay = `${r.title} ${r.taskTitle || ''} ${r.results} ${r.responsibleUserName || ''} ${r.departmentName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, deptFilter, search]);

  const handleDelete = async (r: Report) => {
    if (!activeCompanyId || !actorContext) return;
    setBusy(true);
    try {
      await removeReport(activeCompanyId, r, actorContext);
      if (selectedReport?.id === r.id) setSelectedReport(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Operational &amp; Completion Reports
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Document outcomes, deliverables, observations, and evidence after task completion.
          </p>
        </div>

        {canCreate && (
          <button
            type="button"
            onClick={onCreateReport}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Report
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports by title, task, results, or owner..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
          />
        </div>

        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
        >
          <option value="All">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <FileText className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">No reports available</p>
          <p className="text-xs text-slate-500 mb-4">
            Submit a report once a task is completed to record verified outcomes.
          </p>
          {canCreate && (
            <button
              type="button"
              onClick={onCreateReport}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Report
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500 bg-slate-50">
                  <th className="py-3 px-5">Report Title</th>
                  <th className="py-3 px-4">Related Task</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Responsible</th>
                  <th className="py-3 px-4 text-right">Completed</th>
                  <th className="py-3 px-5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-5 font-medium text-slate-900">{r.title}</td>
                    <td className="py-3 px-4 text-slate-600">{r.taskTitle || 'General'}</td>
                    <td className="py-3 px-4 text-slate-600">{r.departmentName || 'Company-wide'}</td>
                    <td className="py-3 px-4 text-slate-700">
                      {r.responsibleUserName || r.authorName}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatDateOnly(r.taskCompletedAt)}
                    </td>
                    <td className="py-3 px-5 text-right font-mono tabular-nums text-slate-500">
                      {formatTimestamp(r.createdAt, company?.timezone)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 mb-1">
                  {selectedReport.departmentName || 'Company-wide'} · Filed by{' '}
                  {selectedReport.authorName}
                </div>
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  {selectedReport.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {(selectedReport.authorId === activeMember?.userId || isAdmin) && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const target = selectedReport;
                        setSelectedReport(null);
                        onEditReport(target);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleDelete(selectedReport)}
                      aria-label="Delete report"
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-sm">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                <div>
                  <span className="block text-slate-500">Related task</span>
                  <span className="font-medium text-slate-900">
                    {selectedReport.taskTitle || 'General'}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">Responsible user</span>
                  <span className="font-medium text-slate-900">
                    {selectedReport.responsibleUserName || selectedReport.authorName}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">Completion date</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {formatDateOnly(selectedReport.taskCompletedAt)}
                  </span>
                </div>
              </div>

              {selectedReport.description && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">Summary</h3>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedReport.description}
                  </p>
                </div>
              )}

              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-1">
                  Results &amp; Deliverables
                </h3>
                <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedReport.results}
                </p>
              </div>

              {selectedReport.observations && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-1">
                    Observations &amp; Follow-up
                  </h3>
                  <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {selectedReport.observations}
                  </p>
                </div>
              )}

              {selectedReport.attachmentLinks.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">Attachments</h3>
                  <ul className="space-y-1.5">
                    {selectedReport.attachmentLinks.map((url) => (
                      <li key={url}>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-blue-700 hover:underline break-all"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          {url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
