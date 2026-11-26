import {
  AlertCircle,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  Eye,
  Flag,
} from 'lucide-react';
import type { TaskPriority, TaskStatus } from '../types/domain';

export function StatusText({ status }: { status: TaskStatus }) {
  switch (status) {
    case 'Completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>Completed</span>
        </span>
      );
    case 'In Progress':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span>In Progress</span>
        </span>
      );
    case 'Under Review':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Eye className="w-3.5 h-3.5 shrink-0" />
          <span>Under Review</span>
        </span>
      );
    case 'Blocked':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 whitespace-nowrap">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Blocked</span>
        </span>
      );
    case 'Cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 whitespace-nowrap">
          <Ban className="w-3.5 h-3.5 shrink-0" />
          <span>Cancelled</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <Circle className="w-3.5 h-3.5 shrink-0" />
          <span>To Do</span>
        </span>
      );
  }
}

export function PriorityText({ priority }: { priority: TaskPriority }) {
  switch (priority) {
    case 'Urgent':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 whitespace-nowrap">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Urgent</span>
        </span>
      );
    case 'High':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Flag className="w-3.5 h-3.5 shrink-0" />
          <span>High</span>
        </span>
      );
    case 'Medium':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 whitespace-nowrap">
          <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Medium</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 whitespace-nowrap">
          <Flag className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span>Low</span>
        </span>
      );
  }
}
