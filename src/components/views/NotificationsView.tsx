import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Calendar,
  Check,
  CheckCheck,
  MailPlus,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompanyData } from '../../contexts/CompanyDataContext';
import {
  acceptInvitationById,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../lib/firestoreService';
import {
  formatDateOnly,
  formatTimestamp,
  isTaskDueSoon,
  isTaskOverdue,
} from '../../lib/validators';
import type { Task } from '../../types/domain';

interface NotificationsViewProps {
  onOpenTask: (task: Task) => void;
}

export function NotificationsView({ onOpenTask }: NotificationsViewProps) {
  const { firebaseUser, userProfile } = useAuth();
  const {
    company,
    notifications,
    unreadNotificationCount,
    tasks,
    incomingInvitations,
  } = useCompanyData();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);

  const displayed =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  const deadlineAlerts = tasks.filter(
    (t) => isTaskOverdue(t) || isTaskDueSoon(t, 3)
  );

  const handleMarkAll = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    try {
      const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
      await markAllNotificationsRead(firebaseUser.uid, unreadIds);
    } finally {
      setBusy(false);
    }
  };

  const handleToggleRead = async (notifId: string, read: boolean) => {
    if (!firebaseUser) return;
    await markNotificationRead(firebaseUser.uid, notifId, read);
  };

  const handleAcceptInvite = async (invitationId: string) => {
    if (!userProfile) return;
    setBusy(true);
    try {
      await acceptInvitationById(invitationId, userProfile);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-slate-900">
            Notifications
          </h1>
          <p className="text-sm text-slate-600 mt-1 tabular-nums">
            {unreadNotificationCount} unread alert{unreadNotificationCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md ${
                filter === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Unread ({unreadNotificationCount})
            </button>
          </div>

          {unreadNotificationCount > 0 && (
            <button
              type="button"
              disabled={busy}
              onClick={handleMarkAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Pending Invitations */}
      {incomingInvitations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <MailPlus className="w-4 h-4" />
            <span>Pending Company Invitations</span>
          </div>
          <div className="divide-y divide-slate-100">
            {incomingInvitations.map((inv) => (
              <div key={inv.id} className="py-3 flex items-center justify-between gap-4">
                <div className="text-xs">
                  <span className="font-semibold text-slate-900">{inv.companyName}</span>
                  <span className="text-slate-500">
                    {' '}
                    · Role: {inv.role} · Invited by {inv.invitedByName}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleAcceptInvite(inv.id)}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800"
                >
                  Accept Invitation
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Deadline & Overdue Reminders */}
      {deadlineAlerts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>Deadline &amp; Overdue Watchlist</span>
          </div>
          <div className="divide-y divide-slate-100">
            {deadlineAlerts.map((t) => {
              const overdue = isTaskOverdue(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onOpenTask(t)}
                  className="w-full py-2.5 text-left hover:bg-slate-50 flex items-center justify-between gap-4 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">{t.title}</span>
                    <span className="text-slate-500 ml-2">
                      · {t.assigneeName || 'Unassigned'}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 font-mono tabular-nums shrink-0 ${
                      overdue ? 'text-red-700 font-semibold' : 'text-amber-700'
                    }`}
                  >
                    {overdue && <AlertTriangle className="w-3.5 h-3.5" />}
                    {overdue ? 'Overdue: ' : 'Due: '}
                    {formatDateOnly(t.deadline)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Persistent In-App Notifications */}
      {displayed.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <Bell className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-900 mb-1">You are all caught up</p>
          <p className="text-xs text-slate-500">
            Mentions, task assignments, status changes, and company updates will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {displayed.map((n) => {
            const linkedTask =
              n.entityType === 'task' && n.entityId
                ? tasks.find((t) => t.id === n.entityId)
                : undefined;

            return (
              <div
                key={n.id}
                className={`p-5 flex items-start justify-between gap-4 ${
                  !n.read ? 'bg-slate-50/80' : 'bg-white'
                }`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-900">{n.title}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{n.companyName}</span>
                    {!n.read && (
                      <span className="text-[11px] font-medium text-blue-700">Unread</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{n.message}</p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono tabular-nums pt-0.5">
                    <span>{formatTimestamp(n.createdAt, company?.timezone)}</span>
                    {linkedTask && (
                      <button
                        type="button"
                        onClick={() => onOpenTask(linkedTask)}
                        className="font-sans font-medium text-slate-700 hover:underline"
                      >
                        Open task
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleRead(n.id, !n.read)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  {n.read ? 'Mark unread' : 'Mark read'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
