import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Plus,
} from 'lucide-react';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import {
  formatDateOnly,
  formatTimestamp,
  isTaskDueSoon,
  isTaskOverdue,
} from '../../lib/validators';
import type { NavSection, Task } from '../../types/domain';
import { PriorityText, StatusText } from '../StatusText';

interface DashboardViewProps {
  onNavigate: (section: NavSection) => void;
  onSelectTask: (task: Task) => void;
  onCreateTask: () => void;
}

export function DashboardView({
  onNavigate,
  onSelectTask,
  onCreateTask,
}: DashboardViewProps) {
  const {
    company,
    activeMember,
    tasks,
    departments,
    auditLogs,
    can,
  } = useCompanyData();

  const totalTasks = tasks.length;
  const inProgressTasks = tasks.filter(
    (t) => t.status === 'In Progress' || t.status === 'Under Review'
  ).length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const overdueTasks = tasks.filter((t) => isTaskOverdue(t));

  const myTasks = tasks
    .filter((t) => t.assigneeId === activeMember?.userId && t.status !== 'Completed' && t.status !== 'Cancelled')
    .slice(0, 6);

  const highPriorityTasks = tasks
    .filter(
      (t) =>
        (t.priority === 'Urgent' || t.priority === 'High') &&
        t.status !== 'Completed' &&
        t.status !== 'Cancelled'
    )
    .slice(0, 6);

  const upcomingDeadlines = tasks
    .filter((t) => t.deadline && (isTaskOverdue(t) || isTaskDueSoon(t, 7)))
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))
    .slice(0, 6);

  const deptStats = departments.map((dept) => {
    const deptTasks = tasks.filter((t) => t.departmentId === dept.id);
    const done = deptTasks.filter((t) => t.status === 'Completed').length;
    const overdue = deptTasks.filter((t) => isTaskOverdue(t)).length;
    const pct = deptTasks.length ? Math.round((done / deptTasks.length) * 100) : 0;
    return {
      dept,
      total: deptTasks.length,
      done,
      overdue,
      pct,
    };
  });

  const recentActivity =
    can('viewAuditLogs') && auditLogs.length > 0
      ? auditLogs.slice(0, 6).map((l) => ({
          id: l.id,
          actor: l.actorName,
          summary: l.summary,
          time: l.createdAt,
        }))
      : tasks.slice(0, 6).map((t) => ({
          id: t.id,
          actor: t.assigneeName || t.createdByName || 'Member',
          summary: `${t.title} — ${t.status}`,
          time: t.updatedAt,
        }));

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            {company?.name || 'Workspace'} Overview
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Role: {activeMember?.role || 'Member'} · Time zone:{' '}
            {company?.timezone || 'UTC'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {can('createTasks') && (
            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Primary KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Total Tasks</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="font-display text-3xl font-semibold text-slate-900 tabular-nums">
            {totalTasks}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Across {departments.length} departments
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>In Progress</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-display text-3xl font-semibold text-slate-900 tabular-nums">
            {inProgressTasks}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Active &amp; under review
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-display text-3xl font-semibold text-slate-900 tabular-nums">
            {completedTasks}
          </div>
          <div className="text-xs text-slate-500 mt-1 tabular-nums">
            {totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0}% completion rate
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 mb-2">
            <span>Overdue Tasks</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div
            className={`font-display text-3xl font-semibold tabular-nums ${
              overdueTasks.length > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
          >
            {overdueTasks.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {overdueTasks.length > 0 ? 'Requires immediate attention' : 'All deadlines nominal'}
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Assigned To Current User */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Assigned to You
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('my-tasks')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              View all
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {myTasks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              You have no active tasks assigned right now.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-medium text-slate-500">
                    <th className="py-2.5 px-6">Task</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Priority</th>
                    <th className="py-2.5 px-6 text-right">Deadline</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {myTasks.map((t) => {
                    const overdue = isTaskOverdue(t);
                    return (
                      <tr
                        key={t.id}
                        onClick={() => onSelectTask(t)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-6">
                          <div className="font-medium text-slate-900 truncate max-w-[240px]">
                            {t.title}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {t.departmentName || 'General'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusText status={t.status} />
                        </td>
                        <td className="py-3 px-4">
                          <PriorityText priority={t.priority} />
                        </td>
                        <td
                          className={`py-3 px-6 text-right font-mono tabular-nums whitespace-nowrap ${
                            overdue ? 'text-red-700 font-semibold' : 'text-slate-600'
                          }`}
                        >
                          {formatDateOnly(t.deadline)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Upcoming &amp; Overdue Deadlines
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('calendar')}
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Timeline
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No deadlines due within the next 7 days.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingDeadlines.map((t) => {
                const overdue = isTaskOverdue(t);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelectTask(t)}
                    className="w-full px-6 py-3.5 text-left hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-slate-900 truncate">
                        {t.title}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {t.assigneeName || 'Unassigned'} · {t.departmentName || 'General'}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums ${
                          overdue ? 'text-red-700 font-semibold' : 'text-amber-700 font-medium'
                        }`}
                      >
                        <Calendar className="w-3 h-3" />
                        {formatDateOnly(t.deadline)}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {overdue ? 'Overdue' : 'Due soon'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Department Statistics, High-Priority Tasks, Recent Activity */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Department Task Statistics */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Department Statistics
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('departments')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              Manage
            </button>
          </div>

          {deptStats.length === 0 ? (
            <p className="text-xs text-slate-500">No departments created yet.</p>
          ) : (
            <div className="space-y-4">
              {deptStats.map(({ dept, total, done, overdue, pct }) => (
                <div key={dept.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-900">{dept.name}</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {done}/{total} ({pct}%)
                      {overdue > 0 ? ` · ${overdue} late` : ''}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* High-Priority Tasks */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-slate-900">
              High &amp; Urgent Priority
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('all-tasks')}
              className="text-xs font-medium text-slate-600 hover:text-slate-900"
            >
              All tasks
            </button>
          </div>

          {highPriorityTasks.length === 0 ? (
            <p className="text-xs text-slate-500">No high or urgent open tasks.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {highPriorityTasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTask(t)}
                  className="w-full py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900 truncate">
                      {t.title}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {t.assigneeName || 'Unassigned'}
                    </div>
                  </div>
                  <PriorityText priority={t.priority} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6">
          <h2 className="font-display text-sm font-semibold text-slate-900 mb-4">
            Recent Activity
          </h2>

          {recentActivity.length === 0 ? (
            <p className="text-xs text-slate-500">No activity recorded yet.</p>
          ) : (
            <div className="space-y-3.5">
              {recentActivity.map((item) => (
                <div key={item.id} className="text-xs">
                  <div className="text-slate-900 font-medium">{item.actor}</div>
                  <div className="text-slate-600 mt-0.5">{item.summary}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 font-mono tabular-nums">
                    {formatTimestamp(item.time, company?.timezone)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
