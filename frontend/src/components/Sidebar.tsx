'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import {
  DashboardIcon,
  PlusIcon,
  FileTextIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  ChartIcon,
  BellIcon,
} from './Icons';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    if (isAdmin) {
      api.reports
        .getAdminStats()
        .then((stats) => setPendingCount(stats.pendingLeaves))
        .catch(() => {});
    }
  }, [isAdmin, pathname]);

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const handleSignOut = () => {
    logout();
    router.push('/login');
  };

  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'DZ';

  return (
    <aside className="dashboard-sidebar">
      <Link href="/dashboard" className="dashboard-brand">
        <span>DUROZEN</span>
        <small>LEAVE</small>
      </Link>

      <nav>
        <div className="sidebar-nav-section-label">General</div>

        <Link href="/dashboard" className={isActive('/dashboard') ? 'selected' : ''}>
          <DashboardIcon size={16} />
          <span>Dashboard</span>
        </Link>

        {user?.role === 'EMPLOYEE' && (
          <>
            <Link href="/apply-leave" className={isActive('/apply-leave') ? 'selected' : ''}>
              <PlusIcon size={16} />
              <span>Apply Leave</span>
            </Link>

            <Link href="/my-leaves" className={isActive('/my-leaves') ? 'selected' : ''}>
              <FileTextIcon size={16} />
              <span>My Leaves</span>
            </Link>
          </>
        )}

        <Link href="/calendar" className={isActive('/calendar') ? 'selected' : ''}>
          <CalendarIcon size={16} />
          <span>Leave Calendar</span>
        </Link>

        {isAdmin && (
          <>
            <div className="sidebar-nav-section-label" style={{ marginTop: 10 }}>
              Administration
            </div>

            <Link href="/admin/pending" className={isActive('/admin/pending') ? 'selected' : ''}>
              <ClockIcon size={16} />
              <span>Pending Queue</span>
              {pendingCount > 0 && <span className="sidebar-pending-count">{pendingCount}</span>}
            </Link>

            <Link href="/admin/leaves" className={isActive('/admin/leaves') ? 'selected' : ''}>
              <FileTextIcon size={16} />
              <span>All Requests</span>
            </Link>

            <Link href="/admin/employees" className={isActive('/admin/employees') ? 'selected' : ''}>
              <UsersIcon size={16} />
              <span>Team Directory</span>
            </Link>

            <Link href="/admin/reports" className={isActive('/admin/reports') ? 'selected' : ''}>
              <ChartIcon size={16} />
              <span>Reports & Analytics</span>
            </Link>

            <Link href="/admin/notifications" className={isActive('/admin/notifications') ? 'selected' : ''}>
              <BellIcon size={16} />
              <span>Audit Logs</span>
            </Link>
          </>
        )}
      </nav>

      {/* Replicated Bottom User Profile Tile */}
      <button
        type="button"
        className="dashboard-user"
        onClick={handleSignOut}
        title="Click to sign out"
      >
        <span className="dashboard-user-avatar">{initials}</span>
        <div className="dashboard-user-details">
          <strong>{user?.name || 'User'}</strong>
          <small>{user?.role} {user?.employeeId ? `• ${user.employeeId}` : ''}</small>
        </div>
        <span className="dashboard-signout-icon" aria-hidden="true">
          ↪
        </span>
      </button>
    </aside>
  );
};