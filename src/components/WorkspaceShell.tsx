import { useMemo, useState } from 'react';
import {
  Bell,
  Building,
  Building2,
  Calendar,
  CheckSquare,
  ChevronDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Plus,
  Settings,
  UserCircle,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCompanyData } from '../contexts/CompanyDataContext';
import type { NavSection, Report, Task } from '../types/domain';
import { CompanyOnboarding } from './CompanyOnboarding';
import { ReportFormModal } from './ReportFormModal';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskFormModal } from './TaskFormModal';
import { CompanySettingsView } from './views/CompanySettingsView';
import { DashboardView } from './views/DashboardView';
import { DepartmentsView } from './views/DepartmentsView';
import { NotificationsView } from './views/NotificationsView';
import { ProjectsView } from './views/ProjectsView';
import { ReportsView } from './views/ReportsView';
import { TasksView } from './views/TasksView';
import { TeamMembersView } from './views/TeamMembersView';
import { TimelineCalendarView } from './views/TimelineCalendarView';
import { UserProfileView } from './views/UserProfileView';

const NAV_ITEMS: { id: NavSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'my-tasks', label: 'My Tasks', icon: CheckSquare },
  { id: 'all-tasks', label: 'All Tasks', icon: ListTodo },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'departments', label: 'Departments', icon: Building },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'team', label: 'Team Members', icon: Users },
  { id: 'company-settings', label: 'Company Settings', icon: Settings },
  { id: 'profile', label: 'User Profile', icon: UserCircle },
];

export function WorkspaceShell() {
  const { userProfile, logout } = useAuth();
  const {
    memberships,
    activeCompanyId,
    switchCompany,
    company,
    activeMember,
    tasks,
    unreadNotificationCount,
    can,
  } = useCompanyData();

  const [section, setSection] = useState<NavSection>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [showOnboardingOverlay, setShowOnboardingOverlay] = useState(false);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskModalState, setTaskModalState] = useState<{ open: boolean; task?: Task | null }>({
    open: false,
  });
  const [reportModalState, setReportModalState] = useState<{
    open: boolean;
    initialTask?: Task | null;
    report?: Report | null;
  }>({ open: false });

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  if (showOnboardingOverlay) {
    return (
      <CompanyOnboarding
        allowCancel
        onCancel={() => setShowOnboardingOverlay(false)}
        onComplete={() => setShowOnboardingOverlay(false)}
      />
    );
  }

  const currentNavLabel = NAV_ITEMS.find((n) => n.id === section)?.label || 'Dashboard';

  const handleSelectNav = (id: NavSection) => {
    setSection(id);
    setMobileMenuOpen(false);
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand + Company Switcher */}
      <div className="p-4 border-b border-slate-200 space-y-3">
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-7 h-7 rounded-lg bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <span className="font-display text-sm font-semibold text-slate-900 whitespace-nowrap">
            Kestrel Workspace
          </span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setCompanyDropdownOpen((o) => !o)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-2 text-left hover:bg-slate-100 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {company?.name || 'Select Company'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {activeMember?.role || 'Member'}
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
          </button>

          {companyDropdownOpen && (
            <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-lg z-30 py-1">
              {memberships.map((m) => (
                <button
                  key={m.companyId}
                  type="button"
                  onClick={() => {
                    void switchCompany(m.companyId);
                    setCompanyDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center justify-between ${
                    m.companyId === activeCompanyId ? 'font-semibold text-slate-900' : 'text-slate-700'
                  }`}
                >
                  <span className="truncate">{m.companyName}</span>
                  {m.companyId === activeCompanyId && (
                    <span className="text-[10px] text-emerald-700 ml-2">Active</span>
                  )}
                </button>
              ))}
              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setCompanyDropdownOpen(false);
                    setShowOnboardingOverlay(true);
                  }}
                  className="w-full px-3 py-2 text-left text-xs font-medium text-slate-900 hover:bg-slate-50 flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Create or Join Company
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Primary Sidebar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectNav(item.id)}
              className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors whitespace-nowrap ${
                active
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center gap-2.5 truncate">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </span>
              {item.id === 'notifications' && unreadNotificationCount > 0 && (
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-slate-200' : 'text-red-700 font-semibold'
                  }`}
                >
                  {unreadNotificationCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Account Footer */}
      <div className="p-3 border-t border-slate-200 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => handleSelectNav('profile')}
          className="min-w-0 text-left px-2 py-1 rounded-lg hover:bg-slate-50 flex-1"
        >
          <div className="text-xs font-medium text-slate-900 truncate">
            {userProfile?.displayName}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{userProfile?.email}</div>
        </button>

        <button
          type="button"
          onClick={logout}
          title="Sign out"
          aria-label="Sign out"
          className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 shrink-0"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-3 right-3 p-1.5 text-slate-500 hover:text-slate-900 z-20"
            >
              <X className="w-4 h-4" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar Contract: Breadcrumb on left, primary action on right */}
        <header className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-slate-600 hover:text-slate-900 rounded-lg"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 min-w-0 truncate">
              <span className="font-medium text-slate-700 truncate">
                {company?.name || 'Workspace'}
              </span>
              <span aria-hidden="true">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {can('createTasks') && (
              <button
                type="button"
                onClick={() => setTaskModalState({ open: true, task: null })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>
            )}
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1400px] w-full mx-auto">
          {section === 'dashboard' && (
            <DashboardView
              onNavigate={handleSelectNav}
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onCreateTask={() => setTaskModalState({ open: true, task: null })}
            />
          )}

          {section === 'my-tasks' && (
            <TasksView
              scope="mine"
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onCreateTask={() => setTaskModalState({ open: true, task: null })}
            />
          )}

          {section === 'all-tasks' && (
            <TasksView
              scope="all"
              onSelectTask={(t) => setSelectedTaskId(t.id)}
              onCreateTask={() => setTaskModalState({ open: true, task: null })}
            />
          )}

          {section === 'projects' && <ProjectsView />}
          {section === 'departments' && <DepartmentsView />}

          {section === 'reports' && (
            <ReportsView
              onCreateReport={() => setReportModalState({ open: true })}
              onEditReport={(report) => setReportModalState({ open: true, report })}
            />
          )}

          {section === 'calendar' && (
            <TimelineCalendarView onSelectTask={(t) => setSelectedTaskId(t.id)} />
          )}

          {section === 'notifications' && (
            <NotificationsView onOpenTask={(t) => setSelectedTaskId(t.id)} />
          )}

          {section === 'team' && <TeamMembersView />}
          {section === 'company-settings' && <CompanySettingsView />}
          {section === 'profile' && (
            <UserProfileView onOpenOnboarding={() => setShowOnboardingOverlay(true)} />
          )}
        </main>
      </div>

      {/* Modals */}
      {taskModalState.open && (
        <TaskFormModal
          task={taskModalState.task}
          onClose={() => setTaskModalState({ open: false })}
          onSaved={(id) => setSelectedTaskId(id)}
        />
      )}

      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          onEditTask={(t) => setTaskModalState({ open: true, task: t })}
          onCreateReport={(t) =>
            setReportModalState({ open: true, initialTask: t })
          }
        />
      )}

      {reportModalState.open && (
        <ReportFormModal
          initialTask={reportModalState.initialTask}
          report={reportModalState.report}
          onClose={() => setReportModalState({ open: false })}
        />
      )}
    </div>
  );
}
