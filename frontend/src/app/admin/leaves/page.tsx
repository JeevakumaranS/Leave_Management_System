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
  FileTextIcon,
  RefreshIcon,
  DownloadIcon,
  CheckIcon,
  XIcon,
} from '../../../components/Icons';

export default function AllLeavesPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [leaves, setLeaves] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedLeave, setSelectedLeave] = useState<any>(null);

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
      loadLeaves();
    }
  }, [user, authLoading, isAdmin, statusFilter, typeFilter]);

  const loadLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.leaves.getAll({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        leaveType: typeFilter || undefined,
      });
      setLeaves(res.items);
      setTotal(res.total);
    } catch (err: any) {
      error(err.message || 'Failed to load leaves');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadLeaves();
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
              <h1 className="page-title">All Employee Leave Requests</h1>
              <p className="page-subtitle">
                Centralized history and tracking of all company leave records across departments
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={loadLeaves} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshIcon size={14} /> Refresh
              </button>
              <a
                href={api.reports.exportCsvUrl(statusFilter)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
              >
                <DownloadIcon size={16} /> Export CSV
              </a>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="card" style={{ padding: '18px 20px', marginBottom: '20px' }}>
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
              <div style={{ flex: '1', minWidth: '220px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by Employee ID, Name, Request ID or reason..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div style={{ width: '160px' }}>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div style={{ width: '180px' }}>
                <select
                  className="form-select"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option value="">All Leave Types</option>
                  <option value="CASUAL_LEAVE">Casual Leave (PL)</option>
                  <option value="SICK_LEAVE">Sick Leave</option>
                  <option value="EMERGENCY_LEAVE">Emergency Leave</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <button type="submit" className="btn btn-secondary">
                Search
              </button>
              {(search || statusFilter || typeFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                    setTypeFilter('');
                  }}
                  className="btn btn-sm"
                  style={{ border: 'none', color: '#64748b' }}
                >
                  Clear Filters
                </button>
              )}
            </form>
          </div>

          {/* Table */}
          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: '#64748b' }}>Loading leave records...</div>
            </div>
          ) : leaves.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <FileTextIcon size={36} color="#94a3b8" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ fontWeight: 600 }}>No leave records match the selected criteria.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Dates</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Approver Decision</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong style={{ color: '#15213a' }}>{l.requestId}</strong>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {new Date(l.submittedAt).toLocaleDateString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.employeeName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{l.employeeId}</div>
                      </td>
                      <td>
                        <span>{l.leaveType.replace('_', ' ')}</span>
                        {l.otherNote && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{l.otherNote}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: '13px' }}>
                          {new Date(l.startDate).toLocaleDateString()}
                          {l.startDate !== l.endDate ? ` to ${new Date(l.endDate).toLocaleDateString()}` : ''}
                        </div>
                      </td>
                      <td>
                        {l.numberOfDays} Day{l.numberOfDays > 1 ? 's' : ''}
                      </td>
                      <td>
                        <span className={`badge badge-${l.status.toLowerCase()}`}>
                          {l.status}
                        </span>
                      </td>
                      <td>
                        {l.decidedBy ? (
                          <div style={{ fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{l.decidedBy}</div>
                            <div style={{ color: '#64748b' }}>
                              {new Date(l.decidedAt).toLocaleDateString()} ({l.decisionMethod})
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#b45309', fontSize: '12px' }}>Pending</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedLeave(l)}
                          className="btn btn-secondary btn-sm"
                        >
                          Audit & Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedLeave}
        onClose={() => setSelectedLeave(null)}
        title={`Audit & Application Details - ${selectedLeave?.requestId}`}
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLeave(null)}>
            Close
          </button>
        }
      >
        {selectedLeave && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <strong style={{ fontSize: '16px', color: '#15213a' }}>{selectedLeave.requestId}</strong>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Submitted on {new Date(selectedLeave.submittedAt).toLocaleString()}
                </div>
              </div>
              <span className={`badge badge-${selectedLeave.status.toLowerCase()}`}>
                {selectedLeave.status}
              </span>
            </div>

            <table style={{ marginBottom: '16px' }}>
              <tbody>
                <tr>
                  <th style={{ width: '40%' }}>Employee</th>
                  <td>{selectedLeave.employeeName} ({selectedLeave.employeeId})</td>
                </tr>
                <tr>
                  <th>Employee Email</th>
                  <td>{selectedLeave.employeeEmail}</td>
                </tr>
                <tr>
                  <th>Manager Recipient</th>
                  <td>{selectedLeave.managerEmail}</td>
                </tr>
                <tr>
                  <th>Leave Type</th>
                  <td>{selectedLeave.leaveType.replace('_', ' ')}</td>
                </tr>
                {selectedLeave.otherNote && (
                  <tr>
                    <th>Other Note</th>
                    <td>{selectedLeave.otherNote}</td>
                  </tr>
                )}
                <tr>
                  <th>Dates</th>
                  <td>
                    {new Date(selectedLeave.startDate).toLocaleDateString()} to {new Date(selectedLeave.endDate).toLocaleDateString()}
                  </td>
                </tr>
                <tr>
                  <th>Duration</th>
                  <td>{selectedLeave.numberOfDays} Day(s) • {selectedLeave.duration.replace(/_/g, ' ')}</td>
                </tr>
                <tr>
                  <th>Reason</th>
                  <td>{selectedLeave.reason}</td>
                </tr>
                {selectedLeave.decidedBy && (
                  <>
                    <tr>
                      <th>Decided By</th>
                      <td>{selectedLeave.decidedBy}</td>
                    </tr>
                    <tr>
                      <th>Decision Timestamp</th>
                      <td>{new Date(selectedLeave.decidedAt).toLocaleString()}</td>
                    </tr>
                    <tr>
                      <th>Decision Channel</th>
                      <td>{selectedLeave.decisionMethod}</td>
                    </tr>
                  </>
                )}
                {selectedLeave.rejectionRemarks && (
                  <tr>
                    <th>Rejection Remarks</th>
                    <td style={{ color: '#dc2626', fontWeight: 600 }}>{selectedLeave.rejectionRemarks}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
