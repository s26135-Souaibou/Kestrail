import { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import { db } from '../../lib/firebase';
import { formatDateOnly, isTaskOverdue } from '../../lib/validators';
import type { Subtask, Task } from '../../types/domain';
import { PriorityText, StatusText } from '../StatusText';

interface TimelineCalendarViewProps {
  onSelectTask: (task: Task) => void;
}

type HorizonMode = 'day' | 'week' | 'month';

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function TimelineCalendarView({ onSelectTask }: TimelineCalendarViewProps) {
  const { activeCompanyId, tasks } = useCompanyData();
  const [horizon, setHorizon] = useState<HorizonMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [subtasksMap, setSubtasksMap] = useState<Record<string, Subtask[]>>({});

  // Compute timeline window start/end
  const windowDates = useMemo(() => {
    const start = new Date(anchorDate);
    start.setHours(0, 0, 0, 0);
    if (horizon === 'week') {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
    } else if (horizon === 'month') {
      start.setDate(1);
    }

    const count =
      horizon === 'day'
        ? 1
        : horizon === 'week'
          ? 7
          : new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();

    const days: Date[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [anchorDate, horizon]);

  const windowStartIso = toIsoDate(windowDates[0]);
  const windowEndIso = toIsoDate(windowDates[windowDates.length - 1]);

  const shiftAnchor = (dir: -1 | 1) => {
    const next = new Date(anchorDate);
    if (horizon === 'day') next.setDate(next.getDate() + dir);
    else if (horizon === 'week') next.setDate(next.getDate() + dir * 7);
    else next.setMonth(next.getMonth() + dir);
    setAnchorDate(next);
  };

  const scheduledTasks = useMemo(() => {
    return tasks
      .filter((t) => {
        const s = t.startDate || t.deadline;
        const e = t.deadline || t.startDate;
        if (!s || !e) return false;
        if (horizon === 'day') {
          return s <= windowStartIso && e >= windowStartIso;
        }
        return e >= windowStartIso && s <= windowEndIso;
      })
      .sort((a, b) => (a.deadline || a.startDate || '').localeCompare(b.deadline || b.startDate || ''));
  }, [tasks, horizon, windowStartIso, windowEndIso]);

  const overdueList = useMemo(
    () =>
      tasks
        .filter((t) => isTaskOverdue(t))
        .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || '')),
    [tasks]
  );

  // Load subtasks when expanded
  useEffect(() => {
    if (!activeCompanyId) return;
    const idsToFetch = Object.keys(expandedTaskIds).filter(
      (id) => expandedTaskIds[id] && !subtasksMap[id]
    );
    if (idsToFetch.length === 0) return;

    for (const taskId of idsToFetch) {
      void getDocs(
        collection(db, 'companies', activeCompanyId, 'tasks', taskId, 'subtasks')
      ).then((snap) => {
        setSubtasksMap((prev) => ({
          ...prev,
          [taskId]: snap.docs.map((d) => d.data() as Subtask),
        }));
      });
    }
  }, [activeCompanyId, expandedTaskIds, subtasksMap]);

  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const getBarGeometry = (startStr?: string, endStr?: string) => {
    const s = startStr || endStr || windowStartIso;
    const e = endStr || startStr || windowEndIso;
    const totalCols = windowDates.length;
    const startIdx = Math.max(
      0,
      windowDates.findIndex((d) => toIsoDate(d) >= s)
    );
    let endIdx = windowDates.findIndex((d) => toIsoDate(d) >= e);
    if (endIdx === -1) endIdx = totalCols - 1;
    if (endIdx < startIdx) endIdx = startIdx;

    const leftPct = (startIdx / totalCols) * 100;
    const widthPct = Math.max(((endIdx - startIdx + 1) / totalCols) * 100, 100 / totalCols);
    return { leftPct, widthPct };
  };

  const headerLabel = useMemo(() => {
    if (horizon === 'day') {
      return windowDates[0].toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    }
    if (horizon === 'week') {
      return `${formatDateOnly(windowStartIso)} – ${formatDateOnly(windowEndIso)}`;
    }
    return windowDates[0].toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  }, [horizon, windowDates, windowStartIso, windowEndIso]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Timeline &amp; Deadline Management
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Track schedules across day, week, and month views, compare planned vs. actual completion, and monitor overdue work.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            {(['day', 'week', 'month'] as HorizonMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setHorizon(mode)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize transition-colors whitespace-nowrap ${
                  horizon === mode
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue Alert Strip */}
      {overdueList.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-red-800 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{overdueList.length} Overdue Task{overdueList.length === 1 ? '' : 's'}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {overdueList.slice(0, 5).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTask(t)}
                className="text-left px-3 py-1.5 bg-white border border-red-200 rounded-lg text-xs hover:border-red-400"
              >
                <span className="font-medium text-slate-900">{t.title}</span>
                <span className="text-red-700 font-mono tabular-nums ml-2">
                  Due {formatDateOnly(t.deadline)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftAnchor(-1)}
              aria-label="Previous period"
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setAnchorDate(new Date())}
              className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftAnchor(1)}
              aria-label="Next period"
              className="p-1.5 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm font-semibold text-slate-900 font-mono tabular-nums">
            {headerLabel}
          </div>
        </div>

        {/* Grid Header */}
        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-500">
              <div className="col-span-4 px-5 py-2.5">Task &amp; Variance</div>
              <div className="col-span-8 grid" style={{ gridTemplateColumns: `repeat(${windowDates.length}, minmax(0, 1fr))` }}>
                {windowDates.map((d) => {
                  const iso = toIsoDate(d);
                  const isToday = iso === toIsoDate(new Date());
                  return (
                    <div
                      key={iso}
                      className={`py-2.5 text-center border-l border-slate-200/70 font-mono tabular-nums ${
                        isToday ? 'bg-slate-900 text-white font-semibold' : ''
                      }`}
                    >
                      {horizon === 'month'
                        ? d.getDate()
                        : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
                    </div>
                  );
                })}
              </div>
            </div>

            {scheduledTasks.length === 0 ? (
              <div className="p-10 text-center text-xs text-slate-500">
                No tasks scheduled inside {headerLabel}. Add start dates or deadlines to tasks to view them on the timeline.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {scheduledTasks.map((t) => {
                  const overdue = isTaskOverdue(t);
                  const { leftPct, widthPct } = getBarGeometry(t.startDate, t.deadline);
                  const delayedCompletion =
                    t.completedAt && t.deadline && t.completedAt > t.deadline;
                  const subs = subtasksMap[t.id] || [];
                  const expanded = Boolean(expandedTaskIds[t.id]);

                  return (
                    <div key={t.id}>
                      <div className="grid grid-cols-12 items-center hover:bg-slate-50/70">
                        <div className="col-span-4 px-5 py-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onSelectTask(t)}
                              className="text-xs font-medium text-slate-900 hover:underline text-left block truncate max-w-[230px]"
                            >
                              {t.title}
                            </button>
                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 flex-wrap">
                              <StatusText status={t.status} />
                              <span aria-hidden="true">·</span>
                              <PriorityText priority={t.priority} />
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                              Plan: {formatDateOnly(t.deadline)}
                              {t.completedAt && (
                                <span
                                  className={`ml-2 ${
                                    delayedCompletion ? 'text-amber-700' : 'text-emerald-700'
                                  }`}
                                >
                                  · Actual: {formatDateOnly(t.completedAt)}
                                  {delayedCompletion ? ' (Late)' : ' (On time)'}
                                </span>
                              )}
                            </div>
                          </div>

                          {t.subtaskCount > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(t.id)}
                              aria-label="Toggle subtask schedule"
                              className="p-1 text-slate-400 hover:text-slate-900 shrink-0"
                            >
                              {expanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>

                        <div className="col-span-8 px-2 py-3 relative h-12 flex items-center">
                          <div
                            onClick={() => onSelectTask(t)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') onSelectTask(t);
                            }}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            className={`absolute h-6 rounded-md px-2 flex items-center text-[11px] font-medium truncate cursor-pointer transition-opacity hover:opacity-90 ${
                              overdue
                                ? 'bg-red-600 text-white'
                                : t.status === 'Completed'
                                  ? 'bg-emerald-600 text-white'
                                  : t.priority === 'Urgent'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-slate-900 text-white'
                            }`}
                          >
                            {t.assigneeName || t.title}
                          </div>
                        </div>
                      </div>

                      {expanded &&
                        subs.map((s) => {
                          const subGeo = getBarGeometry(
                            s.startDate || t.startDate,
                            s.deadline || t.deadline
                          );
                          const subOverdue = isTaskOverdue(s);
                          return (
                            <div
                              key={s.id}
                              className="grid grid-cols-12 items-center bg-slate-50/70 border-t border-slate-100"
                            >
                              <div className="col-span-4 pl-10 pr-5 py-2 text-[11px] text-slate-700">
                                <div className="font-medium truncate">{s.title}</div>
                                <div className="text-slate-500 font-mono tabular-nums">
                                  {s.assigneeName || 'Unassigned'} · {s.status} · Due{' '}
                                  {formatDateOnly(s.deadline)}
                                </div>
                              </div>
                              <div className="col-span-8 px-2 py-2 relative h-8 flex items-center">
                                <div
                                  style={{
                                    left: `${subGeo.leftPct}%`,
                                    width: `${subGeo.widthPct}%`,
                                  }}
                                  className={`absolute h-4 rounded px-1.5 text-[10px] truncate flex items-center ${
                                    subOverdue
                                      ? 'bg-red-200 text-red-900'
                                      : s.status === 'Completed'
                                        ? 'bg-emerald-200 text-emerald-900'
                                        : 'bg-slate-300 text-slate-900'
                                  }`}
                                >
                                  {s.title}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
