'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import { Sidebar } from '../../../components/Sidebar';
import { Navbar } from '../../../components/Navbar';
import { Modal } from '../../../components/Modal';
import {
  UsersIcon,
  PlusIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
} from '../../../components/Icons';

export default function EmployeeManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [employees, setEmployees] = useState<any[]>([]);
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
  const [formDept, setFormDept] = useState('');
  const [formDesignation, setFormDesignation] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [saving, setSaving] = useState(false);

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
      loadEmployees();
    }
  }, [user, authLoading, isAdmin, statusFilter]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await api.employees.getAll({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      setEmployees(data);
    } catch (err: any) {
      error(err.message || 'Failed to load employee directory');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setFormId(`EMP-${100 + employees.length + 1}`);
    setFormName('');
    setFormEmail('');
    setFormStatus('ACTIVE');
    setFormDept('Engineering');
    setFormDesignation('Software Engineer');
    setFormPassword('Password@123');
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formId.trim() || !formName.trim() || !formEmail.trim()) {
      error('Employee ID, Name and Email are mandatory fields.');
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
          status: formStatus,
          department: formDept,
          designation: formDesignation,
          password: formPassword || 'Password@123',
        });
        success(`New employee ${formName} (${formId}) created! Ready in leave application dropdown.`);
      }

      setIsModalOpen(false);
      loadEmployees();
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
              <h1 className="page-title">Employee Directory & Account Management</h1>
              <p className="page-subtitle">
                Register new employees, update details, or toggle active/inactive status (SRS Section 3)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={loadEmployees} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshIcon size={14} /> Refresh
              </button>
              <button onClick={handleOpenAdd} className="btn btn-primary btn-sm">
                <PlusIcon size={16} /> Add Employee
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
              <div style={{ flex: '1', minWidth: '240px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by Employee ID, Name, Department or Email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyUp={(e) => e.key === 'Enter' && loadEmployees()}
                />
              </div>

              <div style={{ width: '160px' }}>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="INACTIVE">Inactive Only</option>
                </select>
              </div>

              <button onClick={loadEmployees} className="btn btn-secondary">
                Search
              </button>
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
                    <th>Department / Designation</th>
                    <th>Account Status</th>
                    <th>Quota (Used / Total)</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
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
                        <div>{emp.department}</div>
                        <div style={{ fontSize: '11.5px', color: '#64748b' }}>{emp.designation || 'Team Member'}</div>
                      </td>
                      <td>
                        <span className={`badge badge-${emp.status.toLowerCase()}`}>
                          {emp.status}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{emp.usedQuota}</span> / {emp.annualQuota} Days
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => handleOpenEdit(emp)}
                            className="btn btn-secondary btn-sm"
                          >
                            Edit
                          </button>
                          {emp.role !== 'DIRECTOR' && (
                            <button
                              onClick={() => handleToggleStatus(emp)}
                              className={`btn btn-sm ${emp.status === 'ACTIVE' ? 'btn-danger' : 'btn-success'}`}
                              title={emp.status === 'ACTIVE' ? 'Deactivate Employee' : 'Activate Employee'}
                            >
                              {emp.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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
        </main>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? `Edit Employee - ${editingEmployee.employeeId}` : 'Add New Employee'}
      >
        <form onSubmit={handleSave}>
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
            <div className="form-helper">SRS 3.1: Mandatory and unique identifier</div>
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
            <div className="form-helper">SRS 3.1: Mandatory full legal/registered name</div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Employee Email ID <span className="required">*</span>
            </label>
            <input
              type="email"
              className="form-input"
              placeholder="e.g. john.doe@durozen.in"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
            <div className="form-helper">SRS 3.1: Mandatory, valid and unique corporate email</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
            <select
              className="form-select"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as any)}
            >
              <option value="ACTIVE">Active (Can log in & apply for leaves)</option>
              <option value="INACTIVE">Inactive (Deactivated • Cannot apply for leaves)</option>
            </select>
            <div className="form-helper">SRS 3.1 & 3.4: Deactivation preserves leave history (BR-16)</div>
          </div>

          {!editingEmployee && (
            <div className="form-group">
              <label className="form-label">Initial Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Default: Password@123"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
              />
              <div className="form-helper">Leave empty for default &apos;Password@123&apos;</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : editingEmployee ? 'Save Changes' : 'Create Employee'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
