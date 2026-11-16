'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/api';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { useLiveDataRefresh } from '../lib/use-live-data-refresh';
import {
  DashboardIcon,
  PlusIcon,
  FileTextIcon,
  CalendarIcon,
  ClockIcon,
  UsersIcon,
  ChartIcon,
  BellIcon,
  MenuIcon,
  XIcon,
} from './Icons';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const { success, error } = useToast();
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Close mobile drawer on route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const refreshPendingCount = async () => {
    if (!isAdmin) return;
    const stats = await api.reports.getAdminStats();
    setPendingCount(stats.pendingLeaves);
  };

  useEffect(() => {
    if (isAdmin) {
      refreshPendingCount().catch((refreshError) => {
        console.error('Failed to refresh the pending approval count.', refreshError);
      });
    }
  }, [isAdmin, pathname]);

  useLiveDataRefresh(refreshPendingCount, isAdmin);

  const isActive = (path: string) => {
    if (path === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(path);
  };

  const handleSignOut = () => {
    setMobileMenuOpen(false);
    logout();
    router.push('/login');
  };

  const closeChangePassword = () => {
    setChangePasswordOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      error('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const result = await api.auth.changePassword({ currentPassword, newPassword });
      success(result.message);
      closeChangePassword();
    } catch (err: any) {
      error(err.message || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
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
    <>
      {/* Sticky Mobile Top Header Bar (active on mobile viewport <= 820px) */}
      <div className="mobile-top-bar">
        <button
          type="button"
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          title="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
        </button>

        <Link href="/dashboard" className="mobile-brand" onClick={() => setMobileMenuOpen(false)}>
          <img
            src="/logoo.png"
            alt="Durozen Logo"
            style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'contain' }}
          />
          <span>DUROZEN</span>
          <small>LEAVE</small>
        </Link>

        <div className="mobile-user-actions">
          <button
            type="button"
            className="mobile-avatar-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title={user?.name || 'Account menu'}
          >
            {initials}
          </button>
        </div>
      </div>

      {/* Backdrop overlay for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`dashboard-sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        {/* Mobile Drawer Header with Close Button */}
        <div className="mobile-drawer-header">
          <Link href="/dashboard" className="dashboard-brand" onClick={() => setMobileMenuOpen(false)}>
            <img
              src="/logoo.png"
              alt="Durozen Logo"
              style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }}
            />
            <span>DUROZEN</span>
            <small>LEAVE</small>
          </Link>
          <button
            type="button"
            className="mobile-drawer-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Desktop Brand */}
        <Link href="/dashboard" className="dashboard-brand desktop-only-brand">
          <img
            src="/logoo.png"
            alt="Durozen Logo"
            style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'contain' }}
          />
          <span>DUROZEN</span>
          <small>LEAVE</small>
        </Link>

        <nav>
          <div className="sidebar-nav-section-label">General</div>

          <Link
            href="/dashboard"
            className={isActive('/dashboard') ? 'selected' : ''}
            onClick={() => setMobileMenuOpen(false)}
          >
            <DashboardIcon size={16} />
            <span>Dashboard</span>
          </Link>

          {user?.role === 'EMPLOYEE' && (
            <>
              <Link
                href="/apply-leave"
                className={isActive('/apply-leave') ? 'selected' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <PlusIcon size={16} />
                <span>Apply Leave</span>
              </Link>

              <Link
                href="/my-leaves"
                className={isActive('/my-leaves') ? 'selected' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileTextIcon size={16} />
                <span>My Leaves</span>
              </Link>
            </>
          )}

          <Link
            href="/calendar"
            className={isActive('/calendar') ? 'selected' : ''}
            onClick={() => setMobileMenuOpen(false)}
          >
            <CalendarIcon size={16} />
            <span>Leave Calendar</span>
          </Link>

          {isAdmin && (
            <>
              <div className="sidebar-nav-section-label" style={{ marginTop: 10 }}>
                Administration
              </div>

              <Link
                href="/admin/pending"
                className={isActive('/admin/pending') ? 'selected' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <ClockIcon size={16} />
                <span>Pending Queue</span>
                {pendingCount > 0 && <span className="sidebar-pending-count">{pendingCount}</span>}
              </Link>

              <Link
                href="/admin/leaves"
                className={isActive('/admin/leaves') ? 'selected' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <FileTextIcon size={16} />
                <span>All Requests</span>
              </Link>

              <Link
                href="/admin/employees"
                className={isActive('/admin/employees') ? 'selected' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <UsersIcon size={16} />
                <span>Employee Management</span>
              </Link>

              <Link
                href="/admin/reports"
                className={isActive('/admin/reports') ? 'selected' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <ChartIcon size={16} />
                <span>Reports & Analytics</span>
              </Link>

              <Link
                href="/admin/notifications"
                className={isActive('/admin/notifications') ? 'selected' : ''}
                onClick={() => setMobileMenuOpen(false)}
              >
                <BellIcon size={16} />
                <span>Audit Logs</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-account-actions">
          <button
            type="button"
            className="sidebar-change-password"
            onClick={() => {
              setMobileMenuOpen(false);
              setChangePasswordOpen(true);
            }}
          >
            Change Password
          </button>
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
            <span className="dashboard-signout-text">
              Sign Out ↪
            </span>
          </button>
        </div>
      </aside>

      <Modal
        isOpen={changePasswordOpen}
        onClose={closeChangePassword}
        title="Change Password"
      >
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label className="form-label" htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              type="password"
              className="form-input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={changingPassword}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-password">New password</label>
            <input
              id="new-password"
              type="password"
              className="form-input"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={changingPassword}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              type="password"
              className="form-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              disabled={changingPassword}
            />
          </div>
          <div className="form-helper">New password must be at least 8 characters.</div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeChangePassword}
              disabled={changingPassword}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={changingPassword}>
              {changingPassword ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};