'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import { Sidebar } from '../../../components/Sidebar';
import { Navbar } from '../../../components/Navbar';
import { Modal } from '../../../components/Modal';
import { AnimatedSelect } from '../../../components/AnimatedSelect';
import { PAGE_SIZE, PaginationControls } from '../../../components/PaginationControls';
import { useLiveDataRefresh } from '../../../lib/use-live-data-refresh';
import {
  UsersIcon,
  PlusIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
  EyeIcon,
  EyeOffIcon,
} from '../../../components/Icons';

export default function EmployeeManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [employees, setEmployees] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<any>(null);

  // Form Fields
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [formRole, setFormRole] = useState<'EMPLOYEE' | 'HR'>('EMPLOYEE');
  const [formDept, setFormDept] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (!isAdmin) {
        router.push('/dashboard');
        return;
      }
      const timer = window.setTimeout(() => {
        loadEmployees();
      }, 250);
      return () => window.clearTimeout(timer);
    }
  }, [user, authLoading, isAdmin, statusFilter, search, page]);

  const loadEmployees = async (targetPage = page, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.employees.getAll({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        page: targetPage,
        limit: PAGE_SIZE,
      });
      setEmployees(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err: any) {
      if (silent) throw err;
      error(err.message || 'Failed to load employee management');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveDataRefresh(() => loadEmployees(page, true), Boolean(user && isAdmin));

  const handleOpenAdd = (role: 'EMPLOYEE' | 'HR' = 'EMPLOYEE') => {
    setEditingEmployee(null);
    setFormRole(role);
    setFormId(`${role === 'HR' ? 'HR' : 'EMP'}-${100 + total + 1}`);
    setFormName('');
    setFormEmail('');
    setFormStatus('ACTIVE');
    setFormDept(role === 'HR' ? 'Human Resources' : 'Engineering');
    setFormDesignation(role === 'HR' ? 'HR Administrator' : 'Software Engineer');
    setFormPassword('');
    setShowFormPassword(false);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: any) => {
    setEditingEmployee(emp);
    setFormId(emp.employeeId);
    setFormName(emp.name);
    setFormEmail(emp.email);
    setFormStatus(emp.status);
    setFormDept(emp.department || '');
    setFormDesignation(emp.designation || '');
    setFormPassword('');
    setShowFormPassword(false);
    setIsModalOpen(true);
  };

  const handleToggleStatus = async (emp: any) => {
    try {
      const res = await api.employees.toggleStatus(emp.id);
      success(`Employee ${emp.name} is now ${res.status}`);
      loadEmployees();
    } catch (err: any) {
      error(err.message || 'Failed to change status');
    }
  };

  const handleDelete = async (emp: any) => {
    if (emp.status === 'ACTIVE') {
      error('Deactivate this employee before deleting the account.');
      return;
    }

    const leaveRequestCount = emp._count?.leaveRequests || 0;
    const confirmed = window.confirm(
      `Permanently delete ${emp.name} (${emp.employeeId})? This will also permanently delete ${leaveRequestCount} leave request(s) and their related records. This action cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(emp.id);
    try {
      await api.employees.delete(emp.id);
      success(`${emp.name} (${emp.employeeId}) was deleted.`);
      setIsModalOpen(false);
      if (employees.length === 1 && page > 1) {
        setPage(page - 1);
      } else {
        await loadEmployees();
      }
    } catch (err: any) {
      error(err.message || 'Failed to delete account');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formId.trim() || !formName.trim() || !formEmail.trim()) {
      error('Employee ID, Name and Email are mandatory fields.');
      return;
    }
    if (!editingEmployee && !formPassword.trim()) {
      error('Initial password is required.');
      return;
    }

    setSaving(true);
    try {
      if (editingEmployee) {
        await api.employees.update(editingEmployee.id, {
          name: formName,
          email: formEmail,
          status: formStatus,
          department: formDept,
          designation: formDesignation,
        });
        success(`Employee record ${formId} updated successfully.`);
      } else {
        await api.employees.create({
          employeeId: formId,
          name: formName,
          email: formEmail,
          role: formRole,
          status: formStatus,
          department: formDept,
          designation: formDesignation,
          password: formPassword,
        });
        success(
          formRole === 'HR'
            ? `HR account ${formName} (${formId}) created successfully.`
            : `New employee ${formName} (${formId}) created! Ready in leave application dropdown.`,
        );
      }

      setIsModalOpen(false);
      if (page === 1) loadEmployees(1);
      else setPage(1);
    } catch (err: any) {
      error(err.message || 'Failed to save employee record');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !isAdmin) return null;

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar />

        <main className="page-container">
          <div className="page-header">
            <div>
              <h1 className="page-title">Employee Management</h1>
              <p className="page-subtitle">
                Register new employees, update details, or toggle active/inactive status
              </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => loadEmployees()} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshIcon size={14} /> Refresh
              </button>
              <button onClick={() => handleOpenAdd('HR')} className="btn btn-secondary btn-sm">
                <PlusIcon size={16} /> Add HR
              </button>
              <button onClick={() => handleOpenAdd()} className="btn btn-primary btn-sm">
                <PlusIcon size={16} /> Add Employee
              </button>
            </div>
          </div>

          {/* Search Bar - Single Row */}
          <div className="card compact-search-card" style={{ padding: '8px 12px', marginBottom: '14px' }}>
            <div className="compact-search-row">
              <div style={{ flex: '1', minWidth: '130px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Auto-search Employee ID, Name, Department..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  style={{ height: '32px', fontSize: '12px', padding: '4px 8px' }}
                />
              </div>

              <div style={{ width: '130px', flexShrink: 0 }}>
                <AnimatedSelect
                  value={statusFilter}
                  onChange={(value) => {
                    setStatusFilter(value);
                    setPage(1);
                  }}
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </AnimatedSelect>
              </div>

              {(search || statusFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                    setPage(1);
                  }}
                  className="btn btn-secondary btn-sm"
                  title="Clear filters"
                  style={{ height: '32px', padding: '0 8px', fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  <XIcon size={12} /> Clear
                </button>
              )}
            </div>
          </div>

          {/* Employee Table */}
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: '#64748b' }}>Loading employees list...</div>
            </div>
          ) : employees.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <UsersIcon size={36} color="#94a3b8" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontWeight: 600 }}>No employees found matching the filter.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Employee ID</th>
                    <th>Full Name</th>
                    <th>Corporate Email</th>
                    <th>Role</th>
                    <th>Designation / Department</th>
                    <th>Account Status</th>
                    <th style={{ textAlign: 'center', minWidth: '190px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td>
                        <strong style={{ color: '#15213a' }}>{emp.employeeId}</strong>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{emp.name}</div>
                      </td>
                      <td>{emp.email}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: emp.role === 'DIRECTOR' ? '#fef3c7' : emp.role === 'HR' ? '#dcfce7' : '#eff6ff', color: emp.role === 'DIRECTOR' ? '#b45309' : emp.role === 'HR' ? '#15803d' : '#1e40af' }}>
                          {emp.role}
                        </span>
                      </td>
                      <td>
                        <div>{emp.designation || 'Team Member'}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{emp.department}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${emp.status.toLowerCase()}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
                          {emp.role !== 'DIRECTOR' && (
                            <button
                              onClick={() => handleToggleStatus(emp)}
                              className={`btn btn-sm ${emp.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                              title={emp.status === 'ACTIVE' ? 'Deactivate Employee' : 'Activate Employee'}
                              style={{ width: 96, justifyContent: 'center' }}
                            >
                              {emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          )}
                          {!(user?.role === 'HR' && emp.role === 'DIRECTOR') && (
                            <button
                              onClick={() => handleOpenEdit(emp)}
                              className="btn btn-secondary btn-sm"
                              style={{ width: 68, justifyContent: 'center' }}
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && employees.length > 0 && (
            <PaginationControls currentPage={page} totalItems={total} onPageChange={setPage} />
          )}
        </main>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          editingEmployee
            ? `Edit Employee - ${editingEmployee.employeeId}`
            : formRole === 'HR'
            ? 'Add New HR User'
            : 'Add New Employee'
        }
      >
        <form onSubmit={handleSave}>
          {!editingEmployee && (
            <div className="form-group">
              <label className="form-label">Account Role</label>
              <input
                type="text"
                className="form-input"
                value={formRole === 'HR' ? 'HR Administrator' : 'Employee'}
                disabled
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              Employee ID <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. EMP-106"
              value={formId}
              onChange={(e) => setFormId(e.target.value)}
              disabled={!!editingEmployee}
              required
            />
            <div className="form-helper">Unique employee identification code</div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Employee Name <span className="required">*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. John Doe"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <div className="form-helper">Full legal/registered name</div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Employee Email ID <span className="required">*</span>
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. john.doe@example.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
            <div className="form-helper">Valid corporate email address</div>
          </div>

          <div className="employee-form-grid">
            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Engineering"
                value={formDept}
                onChange={(e) => setFormDept(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Designation</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Software Engineer"
                value={formDesignation}
                onChange={(e) => setFormDesignation(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Account Status <span className="required">*</span>
            </label>
            <AnimatedSelect
              value={formStatus}
              onChange={(value) => {
                if (value === 'ACTIVE' || value === 'INACTIVE') setFormStatus(value);
              }}
            >
              <option value="ACTIVE">Active (Can log in & apply for leaves)</option>
              <option value="INACTIVE">Inactive (Deactivated • Cannot apply for leaves)</option>
            </AnimatedSelect>
            <div className="form-helper">Deactivating an account preserves all past leave records</div>
          </div>

          {!editingEmployee && (
            <div className="form-group">
              <label className="form-label">
                Initial Password <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showFormPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter an initial password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  style={{ paddingRight: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowFormPassword((visible) => !visible)}
                  aria-label={showFormPassword ? 'Hide initial password' : 'Show initial password'}
                  title={showFormPassword ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    display: 'flex',
                    alignItems: 'center',
                    border: 0,
                    padding: 4,
                    background: 'transparent',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  {showFormPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                </button>
              </div>
              <div className="form-helper">Set the password for this account.</div>
            </div>
          )}

          <div className="employee-form-actions">
            {editingEmployee && editingEmployee.role !== 'DIRECTOR' && editingEmployee.id !== user?.id ? (
              <div>
                <button
                  type="button"
                  onClick={() => handleDelete(editingEmployee)}
                  className="btn btn-danger"
                  disabled={
                    saving ||
                    deletingId === editingEmployee.id ||
                    editingEmployee.status === 'ACTIVE'
                  }
                  title={
                    editingEmployee.status === 'ACTIVE'
                      ? 'Deactivate the employee before deleting the account'
                      : 'Permanently delete this employee and their associated records'
                  }
                >
                  {deletingId === editingEmployee.id ? <><XIcon size={14} /> Deleting...</> : <><XIcon size={14} /> Delete Account</>}
                </button>
                {editingEmployee.status === 'ACTIVE' && (
                  <div className="form-helper">Deactivate this employee to enable deletion.</div>
                )}
              </div>
            ) : <span />}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving
                  ? 'Saving...'
                  : editingEmployee
                  ? 'Save Changes'
                  : formRole === 'HR'
                  ? 'Create HR Account'
                  : 'Create Employee'}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
