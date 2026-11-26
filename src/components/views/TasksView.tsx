import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Columns,
  List,
  Plus,
  Search,
} from 'lucide-react';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import {
  formatDateOnly,
  isTaskOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from '../../lib/validators';
import type { Task, TaskPriority, TaskStatus } from '../../types/domain';
import { PriorityText, StatusText } from '../StatusText';

interface TasksViewProps {
  scope: 'mine' | 'all';
  onSelectTask: (task: Task) => void;
  onCreateTask: () => void;
}

export function TasksView({ scope, onSelectTask, onCreateTask }: TasksViewProps) {
  const { activeMember, tasks, departments, projects, can } = useCompanyData();

  const [layout, setLayout] = useState<'table' | 'board'>('table');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | TaskStatus>('All');
  const [priorityFilter, setPriorityFilter] = useState<'All' | TaskPriority>('All');
  const [deptFilter, setDeptFilter] = useState('All');
  const [projectFilter, setProjectFilter] = useState('All');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const filteredTasks = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks.filter((t) => {
      if (scope === 'mine' && t.assigneeId !== activeMember?.userId) return false;
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'All' && t.priority !== priorityFilter) return false;
      if (deptFilter !== 'All' && t.departmentId !== deptFilter) return false;
      if (projectFilter !== 'All' && t.projectId !== projectFilter) return false;
      if (onlyOverdue && !isTaskOverdue(t)) return false;
      if (q) {
        const hay = `${t.title} ${t.description || ''} ${t.assigneeName || ''} ${t.departmentName || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    tasks,
    scope,
    activeMember?.userId,
    statusFilter,
    priorityFilter,
    deptFilter,
    projectFilter,
    onlyOverdue,
    search,
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            {scope === 'mine' ? 'My Tasks' : 'All Company Tasks'}
          </h1>
          <p className="text-sm text-slate-600 mt-1 tabular-nums">
            Showing {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
            {activeMember?.role === 'Visitor' ? ' (scoped to Visitor permissions)' : ''}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setLayout('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                layout === 'table'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Table
            </button>
            <button
              type="button"
              onClick={() => setLayout('board')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                layout === 'board'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              Board
            </button>
          </div>

          {can('createTasks') && (
            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, assignees, departments..."
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'All' | TaskStatus)}
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
        >
          <option value="All">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value as 'All' | TaskPriority)}
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
        >
          <option value="All">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

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

        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
        >
          <option value="All">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        <label className="inline-flex items-center gap-2 text-xs text-slate-700 px-2">
          <input
            type="checkbox"
            checked={onlyOverdue}
            onChange={(e) => setOnlyOverdue(e.target.checked)}
            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          <span>Overdue only</span>
        </label>
      </div>

      {/* Content */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-slate-900 mb-1">No matching tasks</p>
          <p className="text-xs text-slate-500 mb-4">
            Adjust your filters or create a new task to get started.
          </p>
          {can('createTasks') && (
            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
            >
              <Plus className="w-3.5 h-3.5" />
              Create First Task
            </button>
          )}
        </div>
      ) : layout === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500 bg-slate-50">
                  <th className="py-3 px-5">Task</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Responsible</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4 text-right">Subtasks</th>
                  <th className="py-3 px-4 text-right">Start</th>
                  <th className="py-3 px-5 text-right">Deadline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTasks.map((t) => {
                  const overdue = isTaskOverdue(t);
                  const pct = t.subtaskCount
                    ? Math.round((t.completedSubtaskCount / t.subtaskCount) * 100)
                    : null;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => onSelectTask(t)}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-5">
                        <div className="font-medium text-slate-900">{t.title}</div>
                        {t.projectName && (
                          <div className="text-[11px] text-slate-500">{t.projectName}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {t.departmentName || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {t.assigneeName || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={t.status} />
                      </td>
                      <td className="py-3 px-4">
                        <PriorityText priority={t.priority} />
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {t.subtaskCount > 0
                          ? `${t.completedSubtaskCount}/${t.subtaskCount} (${pct}%)`
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500 whitespace-nowrap">
                        {formatDateOnly(t.startDate)}
                      </td>
                      <td
                        className={`py-3 px-5 text-right font-mono tabular-nums whitespace-nowrap ${
                          overdue ? 'text-red-700 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          {overdue && <AlertTriangle className="w-3 h-3" />}
                          {formatDateOnly(t.deadline)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {TASK_STATUSES.map((colStatus) => {
            const colTasks = filteredTasks.filter((t) => t.status === colStatus);
            return (
              <div
                key={colStatus}
                className="bg-slate-100/70 border border-slate-200 rounded-xl p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-semibold text-slate-800">{colStatus}</span>
                  <span className="text-xs font-mono tabular-nums text-slate-500">
                    {colTasks.length}
                  </span>
                </div>

                {colTasks.length === 0 ? (
                  <div className="p-4 text-center text-[11px] text-slate-400">
                    Empty
                  </div>
                ) : (
                  <div className="space-y-2">
                    {colTasks.map((t) => {
                      const overdue = isTaskOverdue(t);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onSelectTask(t)}
                          className="w-full text-left bg-white border border-slate-200 rounded-lg p-3 hover:border-slate-400 transition-colors space-y-2"
                        >
                          <div className="text-xs font-medium text-slate-900 leading-snug">
                            {t.title}
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <PriorityText priority={t.priority} />
                            {t.deadline && (
                              <span
                                className={`font-mono tabular-nums ${
                                  overdue ? 'text-red-700 font-semibold' : 'text-slate-500'
                                }`}
                              >
                                {formatDateOnly(t.deadline)}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {t.assigneeName || 'Unassigned'}
                            {t.subtaskCount > 0
                              ? ` · ${t.completedSubtaskCount}/${t.subtaskCount} subtasks`
                              : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
