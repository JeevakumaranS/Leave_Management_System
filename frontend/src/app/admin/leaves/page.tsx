'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import { Sidebar } from '../../../components/Sidebar';
import { Navbar } from '../../../components/Navbar';
import { Modal } from '../../../components/Modal';
import { PAGE_SIZE, PaginationControls } from '../../../components/PaginationControls';
import { formatDate, formatDateTime } from '../../../lib/date';
import { useLiveDataRefresh } from '../../../lib/use-live-data-refresh';
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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedLeave, setSelectedLeave] = useState<any>(null);

  // Auto-search debouncer without clicking search button
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

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
      loadLeaves(page);
    }
  }, [user, authLoading, isAdmin, statusFilter, typeFilter, appliedSearch, page]);

  const loadLeaves = async (targetPage = page, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.leaves.getAll({
        search: appliedSearch || undefined,
        status: statusFilter || undefined,
        leaveType: typeFilter || undefined,
        page: targetPage,
        limit: PAGE_SIZE,
      });
      setLeaves(res.items);
      setTotal(res.total);
      setPage(res.page);
    } catch (err: any) {
      if (silent) throw err;
      error(err.message || 'Failed to load leaves');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveDataRefresh(() => loadLeaves(page, true), Boolean(user && isAdmin));

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  };

  const handleExport = async () => {
    try {
      const file = await api.reports.exportCsv(statusFilter || undefined);
      const url = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = url;
      link.download = `durozen_leave_report_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      error(err.message || 'Failed to export leave report');
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
              <h1 className="page-title">All Employee Leave Requests</h1>
              <p className="page-subtitle">
                Centralized history and tracking of all company leave records across departments
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => loadLeaves()} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshIcon size={14} /> Refresh
              </button>
              <button onClick={handleExport} className="btn btn-primary btn-sm">
                <DownloadIcon size={16} /> Export CSV
              </button>
            </div>
          </div>

          {/* Search & Filter Bar - Single Row */}
          <div className="card compact-search-card" style={{ padding: '8px 12px', marginBottom: '14px' }}>
            <div className="compact-search-row">
              <div style={{ flex: '1', minWidth: '120px' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Auto-search Employee ID, Name, Request ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ height: '32px', fontSize: '12px', padding: '4px 8px' }}
                />
              </div>

              <div style={{ width: '120px', flexShrink: 0 }}>
                <select
                  className="form-select"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ height: '32px', fontSize: '12px', padding: '4px 6px' }}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div style={{ width: '125px', flexShrink: 0 }}>
                <select
                  className="form-select"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ height: '32px', fontSize: '12px', padding: '4px 6px' }}
                >
                  <option value="">All Types</option>
                  <option value="CASUAL_LEAVE">Casual Leave</option>
                  <option value="SICK_LEAVE">Sick Leave</option>
                  <option value="EMERGENCY_LEAVE">Emergency</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {(search || statusFilter || typeFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setAppliedSearch('');
                    setStatusFilter('');
                    setTypeFilter('');
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
                          {formatDate(l.submittedAt)}
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
                          {formatDate(l.startDate)}
                          {l.startDate !== l.endDate ? ` to ${formatDate(l.endDate)}` : ''}
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
                        {l.status === 'CANCELLED' ? (
                          <div style={{ fontSize: '12px' }}>
                            <div style={{ fontWeight: 600, color: '#7E8798' }}>Cancelled by Employee</div>
                            {l.decidedAt && (
                              <div style={{ color: '#94A3B8', fontSize: '11px' }}>
                                {formatDateTime(l.decidedAt)}
                              </div>
                            )}
                          </div>
                        ) : l.decidedBy ? (
                          <div style={{ fontSize: '12px' }}>
                            <div style={{ fontWeight: 600 }}>{l.decidedBy}</div>
                            <div style={{ color: '#64748b' }}>
                              {formatDateTime(l.decidedAt)} {l.decisionMethod ? `(${l.decisionMethod})` : ''}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#b45309', fontSize: '12px' }}>Awaiting Decision</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedLeave(l)}
                          className="btn btn-secondary btn-sm"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && leaves.length > 0 && (
            <PaginationControls currentPage={page} totalItems={total} onPageChange={setPage} />
          )}
        </main>
      </div>

      {/* Details Modal */}
      <Modal
        isOpen={!!selectedLeave}
        onClose={() => setSelectedLeave(null)}
        title={`Details - ${selectedLeave?.requestId}`}
        maxWidth="760px"
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
                  Submitted on {formatDateTime(selectedLeave.submittedAt)}
                </div>
              </div>
              <span className={`badge badge-${selectedLeave.status.toLowerCase()}`}>
                {selectedLeave.status}
              </span>
            </div>

            <table
              style={{
                width: '100%',
                tableLayout: 'fixed',
                marginBottom: '16px',
                overflowWrap: 'anywhere',
                whiteSpace: 'normal',
              }}
            >
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
                    {formatDate(selectedLeave.startDate)} to {formatDate(selectedLeave.endDate)}
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
                {selectedLeave.status === 'CANCELLED' ? (
                  <>
                    <tr>
                      <th>Cancellation Detail</th>
                      <td style={{ color: '#7E8798', fontWeight: 600 }}>
                        {selectedLeave.decidedBy || 'Cancelled by Employee'}
                      </td>
                    </tr>
                    {selectedLeave.decidedAt && (
                      <tr>
                        <th>Cancellation Time</th>
                        <td>{formatDateTime(selectedLeave.decidedAt)}</td>
                      </tr>
                    )}
                  </>
                ) : selectedLeave.decidedBy ? (
                  <>
                    <tr>
                      <th>Decided By</th>
                      <td>{selectedLeave.decidedBy}</td>
                    </tr>
                    <tr>
                      <th>Decision Timestamp</th>
                      <td>{formatDateTime(selectedLeave.decidedAt)}</td>
                    </tr>
                    {selectedLeave.decisionMethod && (
                      <tr>
                        <th>Decision Channel</th>
                        <td>{selectedLeave.decisionMethod}</td>
                      </tr>
                    )}
                  </>
                ) : null}
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
