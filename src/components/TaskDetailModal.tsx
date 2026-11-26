import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  AlertTriangle,
  Calendar,
  CheckSquare,
  Edit3,
  FileText,
  History,
  MessageSquare,
  Plus,
  Reply,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useCompanyData } from '../contexts/CompanyDataContext';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  addTaskComment,
  deleteSubtask,
  deleteTask,
  deleteTaskComment,
  saveSubtask,
  updateTask,
} from '../lib/firestoreService';
import {
  formatDateOnly,
  formatTimestamp,
  isTaskOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  toMillis,
} from '../lib/validators';
import type {
  Subtask,
  Task,
  TaskComment,
  TaskHistoryEntry,
  TaskPriority,
  TaskStatus,
} from '../types/domain';
import { PriorityText, StatusText } from './StatusText';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
  onEditTask: (task: Task) => void;
  onCreateReport: (task: Task) => void;
}

export function TaskDetailModal({
  task,
  onClose,
  onEditTask,
  onCreateReport,
}: TaskDetailModalProps) {
  const { activeCompanyId, company, members, activeMember, can, actorContext, activePermissions } =
    useCompanyData();

  const [tab, setTab] = useState<'overview' | 'subtasks' | 'comments' | 'history'>('overview');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [history, setHistory] = useState<TaskHistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subtask form state
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  const [subTitle, setSubTitle] = useState('');
  const [subDesc, setSubDesc] = useState('');
  const [subAssigneeId, setSubAssigneeId] = useState('');
  const [subStatus, setSubStatus] = useState<TaskStatus>('To Do');
  const [subPriority, setSubPriority] = useState<TaskPriority>('Medium');
  const [subStartDate, setSubStartDate] = useState('');
  const [subDeadline, setSubDeadline] = useState('');
  const [subCompletedAt, setSubCompletedAt] = useState('');

  // Comment state
  const [commentBody, setCommentBody] = useState('');
  const [replyTo, setReplyTo] = useState<TaskComment | null>(null);
  const [mentionFilter, setMentionFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompanyId || !task.id) return;
    const base = `companies/${activeCompanyId}/tasks/${task.id}`;

    const unsubSubs = onSnapshot(
      collection(db, 'companies', activeCompanyId, 'tasks', task.id, 'subtasks'),
      (snap) => {
        setSubtasks(
          snap.docs
            .map((d) => d.data() as Subtask)
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${base}/subtasks`)
    );

    const unsubComments = onSnapshot(
      collection(db, 'companies', activeCompanyId, 'tasks', task.id, 'comments'),
      (snap) => {
        setComments(
          snap.docs
            .map((d) => d.data() as TaskComment)
            .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${base}/comments`)
    );

    const unsubHistory = onSnapshot(
      collection(db, 'companies', activeCompanyId, 'tasks', task.id, 'history'),
      (snap) => {
        setHistory(
          snap.docs
            .map((d) => d.data() as TaskHistoryEntry)
            .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, `${base}/history`)
    );

    return () => {
      unsubSubs();
      unsubComments();
      unsubHistory();
    };
  }, [activeCompanyId, task.id]);

  const canEdit = can('editTasks');
  const canDelete = can('deleteTasks');
  const isAssignee = activeMember?.userId === task.assigneeId;
  const isTerminalForAssignee =
    !canEdit && (task.status === 'Completed' || task.status === 'Cancelled');
  const canChangeStatus = canEdit || (isAssignee && !isTerminalForAssignee);
  const canCreateSubtask = can('createTasks') || canEdit;
  const canComment = can('commentOnTasks');
  const overdue = isTaskOverdue(task);

  const completedSubs = subtasks.filter((s) => s.status === 'Completed').length;
  const progressPct = subtasks.length
    ? Math.round((completedSubs / subtasks.length) * 100)
    : task.status === 'Completed'
      ? 100
      : 0;

  const activeMembers = members.filter((m) => m.status === 'active');

  const handleStatusChange = async (newStatus: TaskStatus) => {
    if (!company || !actorContext || !canChangeStatus) return;
    setError(null);
    setBusy(true);
    try {
      await updateTask(
        activeCompanyId,
        company.name,
        task,
        actorContext,
        { status: newStatus },
        !canEdit
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!actorContext || !canDelete) return;
    setBusy(true);
    try {
      await deleteTask(activeCompanyId, task, actorContext);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete task.');
      setBusy(false);
    }
  };

  const openNewSubtask = () => {
    setEditingSubtask(null);
    setSubTitle('');
    setSubDesc('');
    setSubAssigneeId('');
    setSubStatus('To Do');
    setSubPriority('Medium');
    setSubStartDate(task.startDate || '');
    setSubDeadline(task.deadline || '');
    setSubCompletedAt('');
    setShowSubtaskForm(true);
  };

  const openEditSubtask = (s: Subtask) => {
    setEditingSubtask(s);
    setSubTitle(s.title);
    setSubDesc(s.description || '');
    setSubAssigneeId(s.assigneeId || '');
    setSubStatus(s.status);
    setSubPriority(s.priority);
    setSubStartDate(s.startDate || '');
    setSubDeadline(s.deadline || '');
    setSubCompletedAt(s.completedAt || '');
    setShowSubtaskForm(true);
  };

  const handleSaveSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !actorContext) return;
    setError(null);
    setBusy(true);
    try {
      const assignee = activeMembers.find((m) => m.userId === subAssigneeId);
      const statusOnly = Boolean(
        editingSubtask && !canEdit && editingSubtask.assigneeId === activeMember?.userId
      );
      await saveSubtask(
        activeCompanyId,
        company.name,
        task,
        subtasks,
        actorContext,
        {
          id: editingSubtask?.id,
          title: subTitle,
          description: subDesc,
          assigneeId: assignee?.userId || '',
          assigneeName: assignee?.displayName || '',
          status: subStatus,
          priority: subPriority,
          startDate: subStartDate,
          deadline: subDeadline,
          completedAt: subCompletedAt,
        },
        statusOnly
      );
      setShowSubtaskForm(false);
      setEditingSubtask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save subtask.');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickSubtaskStatus = async (s: Subtask, nextStatus: TaskStatus) => {
    if (!company || !actorContext) return;
    const allowed = canEdit || s.assigneeId === activeMember?.userId;
    if (!allowed) return;
    setBusy(true);
    try {
      await saveSubtask(
        activeCompanyId,
        company.name,
        task,
        subtasks,
        actorContext,
        {
          id: s.id,
          title: s.title,
          description: s.description,
          assigneeId: s.assigneeId,
          assigneeName: s.assigneeName,
          status: nextStatus,
          priority: s.priority,
          startDate: s.startDate,
          deadline: s.deadline,
          completedAt: nextStatus === 'Completed' ? new Date().toISOString().slice(0, 10) : '',
        },
        !canEdit
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update subtask.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteSubtask = async (s: Subtask) => {
    if (!actorContext) return;
    setBusy(true);
    try {
      await deleteSubtask(activeCompanyId, task, s, subtasks, actorContext);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete subtask.');
    } finally {
      setBusy(false);
    }
  };

  const handleCommentChange = (val: string) => {
    setCommentBody(val);
    const match = val.match(/@([a-zA-Z0-9 _-]*)$/);
    setMentionFilter(match ? match[1].toLowerCase() : null);
  };

  const insertMention = (name: string) => {
    setCommentBody((prev) => prev.replace(/@([a-zA-Z0-9 _-]*)$/, `@${name} `));
    setMentionFilter(null);
  };

  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !actorContext || !commentBody.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await addTaskComment(
        activeCompanyId,
        company.name,
        task,
        activeMembers,
        actorContext,
        commentBody,
        replyTo?.id
      );
      setCommentBody('');
      setReplyTo(null);
      setMentionFilter(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to post comment.');
    } finally {
      setBusy(false);
    }
  };

  const mentionCandidates =
    mentionFilter !== null
      ? activeMembers
          .filter(
            (m) =>
              m.displayName.toLowerCase().includes(mentionFilter) ||
              m.email.toLowerCase().includes(mentionFilter)
          )
          .slice(0, 5)
      : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <span>{task.departmentName || 'General'}</span>
              {task.projectName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{task.projectName}</span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="font-mono">{task.id}</span>
            </div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              {task.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activePermissions.createReports && (
              <button
                type="button"
                onClick={() => onCreateReport(task)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5" />
                File Report
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => onEditTask(task)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                disabled={busy}
                onClick={handleDeleteTask}
                aria-label="Delete task"
                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close task detail"
              className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-6 border-b border-slate-200 flex items-center gap-6 text-xs font-medium">
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`py-3 border-b-2 transition-colors whitespace-nowrap ${
              tab === 'overview'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab('subtasks')}
            className={`py-3 border-b-2 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'subtasks'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            Subtasks ({completedSubs}/{subtasks.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('comments')}
            className={`py-3 border-b-2 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'comments'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Comments ({comments.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`py-3 border-b-2 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              tab === 'history'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            History ({history.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {error}
            </div>
          )}

          {tab === 'overview' && (
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 mb-2">Description</h3>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                    {task.description || 'No description provided for this task.'}
                  </p>
                </div>

                {/* Subtask Progress Summary */}
                <div className="p-4 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-medium text-slate-700">Subtask Completion</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {completedSubs} / {subtasks.length} ({progressPct}%)
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-slate-900 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {task.tags.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 mb-1.5">Tags</h3>
                    <div className="text-xs text-slate-600">
                      {task.tags.join(' · ')}
                    </div>
                  </div>
                )}
              </div>

              {/* Metadata Sidebar */}
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 text-xs">
                <div>
                  <span className="block text-slate-500 mb-1">Status</span>
                  {canChangeStatus ? (
                    <select
                      value={task.status}
                      disabled={busy}
                      onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                      className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <StatusText status={task.status} />
                  )}
                </div>

                <div>
                  <span className="block text-slate-500 mb-1">Priority</span>
                  <PriorityText priority={task.priority} />
                </div>

                <div>
                  <span className="block text-slate-500 mb-1">Responsible person</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-900">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {task.assigneeName || 'Unassigned'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-500 mb-1">Department</span>
                  <span className="font-medium text-slate-900">
                    {task.departmentName || '—'}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-500 mb-1">Start date</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {formatDateOnly(task.startDate)}
                  </span>
                </div>

                <div>
                  <span className="block text-slate-500 mb-1">Planned deadline</span>
                  <span
                    className={`inline-flex items-center gap-1.5 font-mono tabular-nums ${
                      overdue ? 'text-red-700 font-semibold' : 'text-slate-900'
                    }`}
                  >
                    {overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                    {formatDateOnly(task.deadline)}
                    {overdue && ' (Overdue)'}
                  </span>
                </div>

                {task.completedAt && (
                  <div>
                    <span className="block text-slate-500 mb-1">Actual completion</span>
                    <span className="font-mono tabular-nums text-emerald-700 font-medium">
                      {formatDateOnly(task.completedAt)}
                    </span>
                  </div>
                )}

                <div>
                  <span className="block text-slate-500 mb-1">Created by</span>
                  <span className="text-slate-700">
                    {task.createdByName || 'Member'} ·{' '}
                    {formatTimestamp(task.createdAt, company?.timezone)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {tab === 'subtasks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-600">
                  Progress: <span className="font-mono tabular-nums font-semibold text-slate-900">{completedSubs}/{subtasks.length}</span> completed ({progressPct}%)
                </div>
                {canCreateSubtask && (
                  <button
                    type="button"
                    onClick={openNewSubtask}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Subtask
                  </button>
                )}
              </div>

              {showSubtaskForm && (
                <form
                  onSubmit={handleSaveSubtask}
                  className="p-4 rounded-lg border border-slate-200 bg-slate-50 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">
                      {editingSubtask ? 'Edit Subtask' : 'New Subtask'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowSubtaskForm(false)}
                      className="text-xs text-slate-500 hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>

                  <input
                    type="text"
                    required
                    maxLength={200}
                    value={subTitle}
                    onChange={(e) => setSubTitle(e.target.value)}
                    placeholder="Subtask title"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  />

                  <textarea
                    rows={2}
                    maxLength={2000}
                    value={subDesc}
                    onChange={(e) => setSubDesc(e.target.value)}
                    placeholder="Subtask description..."
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg"
                  />

                  <div className="grid sm:grid-cols-3 gap-3">
                    <select
                      value={subAssigneeId}
                      onChange={(e) => setSubAssigneeId(e.target.value)}
                      className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      <option value="">Unassigned</option>
                      {activeMembers.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>

                    <select
                      value={subStatus}
                      onChange={(e) => setSubStatus(e.target.value as TaskStatus)}
                      className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>

                    <select
                      value={subPriority}
                      onChange={(e) => setSubPriority(e.target.value as TaskPriority)}
                      className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    >
                      {TASK_PRIORITIES.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Start date</label>
                      <input
                        type="date"
                        value={subStartDate}
                        onChange={(e) => setSubStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Deadline</label>
                      <input
                        type="date"
                        value={subDeadline}
                        onChange={(e) => setSubDeadline(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">
                        Completion date
                      </label>
                      <input
                        type="date"
                        value={subCompletedAt}
                        onChange={(e) => setSubCompletedAt(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-lg"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50"
                    >
                      {busy ? 'Saving...' : editingSubtask ? 'Update Subtask' : 'Save Subtask'}
                    </button>
                  </div>
                </form>
              )}

              {subtasks.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 rounded-lg text-xs text-slate-500">
                  No subtasks yet. Break this deliverable into scheduled steps.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {subtasks.map((s) => {
                    const subOverdue = isTaskOverdue(s);
                    const canToggle = canEdit || s.assigneeId === activeMember?.userId;
                    return (
                      <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-medium text-slate-900">{s.title}</span>
                            <PriorityText priority={s.priority} />
                            {subOverdue && (
                              <span className="text-xs font-medium text-red-700">Overdue</span>
                            )}
                          </div>
                          {s.description && (
                            <p className="text-xs text-slate-600">{s.description}</p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                            <span>{s.assigneeName || 'Unassigned'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                              <Calendar className="w-3 h-3" />
                              {formatDateOnly(s.startDate)} → {formatDateOnly(s.deadline)}
                            </span>
                            {s.completedAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-700 font-mono tabular-nums">
                                  Done {formatDateOnly(s.completedAt)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {canToggle ? (
                            <select
                              value={s.status}
                              disabled={busy}
                              onChange={(e) =>
                                handleQuickSubtaskStatus(s, e.target.value as TaskStatus)
                              }
                              className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-md"
                            >
                              {TASK_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <StatusText status={s.status} />
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => openEditSubtask(s)}
                              aria-label="Edit subtask"
                              className="p-1.5 text-slate-400 hover:text-slate-900"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(canEdit || canDelete) && (
                            <button
                              type="button"
                              onClick={() => handleDeleteSubtask(s)}
                              aria-label="Delete subtask"
                              className="p-1.5 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div className="space-y-4">
              {comments.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 rounded-lg text-xs text-slate-500">
                  No comments yet. Use @name to mention a teammate and notify them directly.
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => {
                    const parent = c.parentCommentId
                      ? comments.find((p) => p.id === c.parentCommentId)
                      : null;
                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-lg border border-slate-200 ${
                          parent ? 'ml-6 bg-slate-50' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="text-xs">
                            <span className="font-semibold text-slate-900">{c.authorName}</span>
                            {c.authorRole && (
                              <>
                                <span className="text-slate-400 mx-1.5">·</span>
                                <span className="text-slate-500">{c.authorRole}</span>
                              </>
                            )}
                            <span className="text-slate-400 mx-1.5">·</span>
                            <span className="text-slate-500">
                              {formatTimestamp(c.createdAt, company?.timezone)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {canComment && (
                              <button
                                type="button"
                                onClick={() => setReplyTo(c)}
                                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                              >
                                <Reply className="w-3 h-3" />
                                Reply
                              </button>
                            )}
                            {(c.authorId === activeMember?.userId || can('manageUsers')) && (
                              <button
                                type="button"
                                onClick={() => deleteTaskComment(activeCompanyId, task.id, c.id)}
                                aria-label="Delete comment"
                                className="text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {parent && (
                          <div className="text-[11px] text-slate-500 mb-1.5">
                            Replying to {parent.authorName}: &ldquo;{parent.body.slice(0, 70)}&rdquo;
                          </div>
                        )}

                        <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {canComment && (
                <form onSubmit={handleSendComment} className="pt-2 relative">
                  {replyTo && (
                    <div className="mb-2 px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                      <span>Replying to {replyTo.authorName}</span>
                      <button
                        type="button"
                        onClick={() => setReplyTo(null)}
                        className="text-slate-500 hover:text-slate-900"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {mentionCandidates.length > 0 && (
                    <div className="mb-2 border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                      {mentionCandidates.map((m) => (
                        <button
                          key={m.userId}
                          type="button"
                          onClick={() => insertMention(m.displayName)}
                          className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center justify-between"
                        >
                          <span className="font-medium text-slate-900">{m.displayName}</span>
                          <span className="text-slate-500">{m.role}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={commentBody}
                      onChange={(e) => handleCommentChange(e.target.value)}
                      placeholder="Write a comment... Type @ to mention a teammate"
                      className="flex-1 px-3.5 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={busy || !commentBody.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 disabled:opacity-50 self-end"
                    >
                      <Send className="w-4 h-4" />
                      Post
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'history' && (
            <div>
              {history.length === 0 ? (
                <div className="p-8 text-center border border-slate-200 rounded-lg text-xs text-slate-500">
                  No task history recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-200 border border-slate-200 rounded-lg">
                  {history.map((h) => (
                    <div key={h.id} className="p-3.5 flex items-center justify-between gap-4 text-xs">
                      <div>
                        <span className="font-medium text-slate-900">{h.actorName}</span>{' '}
                        <span className="text-slate-600">{h.action}</span>
                        {h.field && (
                          <span className="text-slate-500">
                            {' '}
                            ({h.field}: {h.oldValue || 'none'} → {h.newValue || 'none'})
                          </span>
                        )}
                      </div>
                      <span className="text-slate-400 font-mono tabular-nums whitespace-nowrap">
                        {formatTimestamp(h.createdAt, company?.timezone)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
