'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { useLiveDataRefresh } from '../../lib/use-live-data-refresh';
import { Sidebar } from '../../components/Sidebar';
import { Navbar } from '../../components/Navbar';
import { Modal } from '../../components/Modal';
import { formatDate } from '../../lib/date';
import { getReasonTextError, normalizeReasonText } from '../../lib/reason-validation';
import {
  UsersIcon,
  ClockIcon,
  CheckIcon,
  XIcon,
  CalendarIcon,
  PlusIcon,
  FileTextIcon,
  RefreshIcon,
} from '../../components/Icons';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [adminStats, setAdminStats] = useState<any>(null);
  const [empStats, setEmpStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Decision Modal State for HR/Director
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [submittingDecision, setSubmittingDecision] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadDashboardData();
    }
  }, [user, authLoading]);

  const loadDashboardData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (isAdmin) {
        const stats = await api.reports.getAdminStats();
        setAdminStats(stats);
      } else {
        const stats = await api.reports.getEmployeeStats();
        if (typeof stats.stats.takenLeaveDays !== 'number') {
          const leaves = await api.leaves.getMyLeaves();
          stats.stats.takenLeaveDays = leaves.reduce(
            (total: number, leave: any) =>
              leave.status === 'APPROVED' ? total + Number(leave.numberOfDays ?? 0) : total,
            0,
          );
        }
        setEmpStats(stats);
      }
    } catch (err: any) {
      if (silent) throw err;
      error(err.message || 'Failed to load dashboard metrics');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveDataRefresh(() => loadDashboardData(true), Boolean(user));

  const handleOpenDecisionModal = (req: any, action: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req);
    setDecisionAction(action);
    setRejectionRemarks('');
  };

  const handleConfirmDecision = async () => {
    if (!selectedRequest) return;
    if (decisionAction === 'REJECT') {
      const remarksError = getReasonTextError(rejectionRemarks, 'Rejection remarks');
      if (remarksError) {
        error(remarksError);
        return;
      }
    }

    setSubmittingDecision(true);
    try {
      await api.approvals.decidePortal(selectedRequest.requestId, {
        action: decisionAction,
        rejectionRemarks:
          decisionAction === 'REJECT' ? normalizeReasonText(rejectionRemarks) : undefined,
      });

      success(
        `Leave request ${selectedRequest.requestId} has been ${
          decisionAction === 'APPROVE' ? 'APPROVED' : 'REJECTED'
        }.`,
      );
      setSelectedRequest(null);
      loadDashboardData();
    } catch (err: any) {
      error(err.message || 'Failed to submit decision');
    } finally {
      setSubmittingDecision(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="content-canvas">
        <Navbar />

        {/* Replicated Page Header Block */}
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              {isAdmin ? 'LEAVE ADMINISTRATION' : 'EMPLOYEE WORKSPACE'}
            </p>
            {isAdmin ? (
              <>
                <h1>{`${user.role === 'DIRECTOR' ? 'Director' : 'HR'} Dashboard`}</h1>
                <p className="subtitle">
                  Centralized tracking of employee leave applications, approval queues, and team capacity.
                </p>
              </>
            ) : (
              <>
                <h1 style={{ fontWeight: 800 }}>
                  Welcome back, {user.name}
                  {user.department ? ` • ${user.department}` : ''}
                </h1>
                <p className="subtitle">
                  Track your leave balance, view upcoming time off, and manage submitted requests.
                </p>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => loadDashboardData()} className="secondary-action" title="Refresh metrics">
              <RefreshIcon size={14} /> Refresh
            </button>
            {user.role === 'EMPLOYEE' ? (
              <Link href="/apply-leave" className="primary">
                <PlusIcon size={15} /> Apply for leave
              </Link>
            ) : (
              <Link href="/admin/leaves" className="primary">
                <FileTextIcon size={15} /> All requests
              </Link>
            )}
          </div>
        </header>

        {loading ? (
          <div className="panel" style={{ textAlign: 'center', padding: '48px' }}>
            <div style={{ color: '#758195', fontSize: '13px' }}>Loading latest metrics...</div>
          </div>
        ) : isAdmin && adminStats ? (
          /* ========================= HR & DIRECTOR VIEW ========================= */
          <>
            {/* 5-Column Live Metrics (Replication from CRM Analysis) */}
            <div className="live-metrics">
              <div className="metric blue">
                <div className="metric-info">
                  <p>Total Staff</p>
                  <h2>{adminStats.totalEmployees}</h2>
                  <small>{adminStats.activeEmployees} Active accounts</small>
                </div>
                <span>
                  <UsersIcon size={18} />
                </span>
              </div>

              <div className="metric amber">
                <div className="metric-info">
                  <p>Pending Decision</p>
                  <h2 style={{ color: '#d49422' }}>{adminStats.pendingLeaves}</h2>
                  <small>Requires review</small>
                </div>
                <span>
                  <ClockIcon size={18} />
                </span>
              </div>

              <div className="metric green">
                <div className="metric-info">
                  <p>Approved Leaves</p>
                  <h2 style={{ color: '#1b9e76' }}>{adminStats.approvedLeaves}</h2>
                  <small>Authorized</small>
                </div>
                <span>
                  <CheckIcon size={18} />
                </span>
              </div>

              <div className="metric red">
                <div className="metric-info">
                  <p>Rejected Requests</p>
                  <h2 style={{ color: '#d75a67' }}>{adminStats.rejectedLeaves}</h2>
                  <small>Declined</small>
                </div>
                <span>
                  <XIcon size={18} />
                </span>
              </div>

              <div className="metric teal">
                <div className="metric-info">
                  <p>On Leave Today</p>
                  <h2 style={{ color: '#287c78' }}>{adminStats.todayOnLeaveCount}</h2>
                  <small>Current absences</small>
                </div>
                <span>
                  <CalendarIcon size={18} />
                </span>
              </div>
            </div>

            {/* Pending Approvals Table */}
            <section className="panel">
              <div className="panel-head">
                <div>
                  <h2>Pending Leave Requests Requiring Decision</h2>
                  <p>
                    Either HR or Director can approve or reject. The first decision recorded becomes final.
                  </p>
                </div>
              </div>

              {adminStats.recentPending.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px', color: '#758195' }}>
                  <CheckIcon size={32} color="#1b9e76" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <p style={{ fontWeight: 600, color: '#17223a' }}>No pending leave requests!</p>
                  <p style={{ fontSize: '12.5px' }}>All employee leave applications have been reviewed.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Employee</th>
                        <th>Leave Type</th>
                        <th>Duration</th>
                        <th>Dates</th>
                        <th>Reason</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {adminStats.recentPending.map((r: any) => (
                        <tr key={r.id}>
                          <td>
                            <strong>{r.requestId}</strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{r.employeeName}</div>
                            <div style={{ fontSize: '11px', color: '#758195' }}>{r.employeeId}</div>
                          </td>
                          <td>
                            <span className="stage-pill stage-info">
                              {r.leaveType.replace('_', ' ')}
                            </span>
                          </td>
                          <td>
                            {r.numberOfDays} Day{r.numberOfDays > 1 ? 's' : ''} ({r.duration.replace(/_/g, ' ')})
                          </td>
                          <td>
                            <div style={{ fontSize: '12px' }}>
                              {formatDate(r.startDate)}
                              {r.startDate !== r.endDate ? ` to ${formatDate(r.endDate)}` : ''}
                            </div>
                          </td>
                          <td style={{ maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.reason}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => handleOpenDecisionModal(r, 'APPROVE')}
                                className="stage-pill stage-approved"
                                style={{ border: 0, cursor: 'pointer', padding: '5px 10px' }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleOpenDecisionModal(r, 'REJECT')}
                                className="stage-pill stage-rejected"
                                style={{ border: 0, cursor: 'pointer', padding: '5px 10px' }}
                              >
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </>
        ) : (
          /* ========================= REGULAR EMPLOYEE VIEW ========================= */
          empStats && (
            <>
              {/* Status Metrics */}
              <div className="live-metrics employee-live-metrics">
                <div className="metric blue">
                  <div className="metric-info">
                    <p>Total Submitted</p>
                    <h2>{empStats.stats.totalRequests}</h2>
                    <small>All applications</small>
                  </div>
                  <span>
                    <FileTextIcon size={18} />
                  </span>
                </div>

                <div className="metric amber">
                  <div className="metric-info">
                    <p>Pending</p>
                    <h2 style={{ color: '#d49422' }}>{empStats.stats.pendingRequests}</h2>
                    <small>Awaiting decision</small>
                  </div>
                  <span>
                    <ClockIcon size={18} />
                  </span>
                </div>

                <div className="metric green">
                  <div className="metric-info">
                    <p>Approved</p>
                    <h2 style={{ color: '#1b9e76' }}>{empStats.stats.approvedRequests}</h2>
                    <small>Granted leave</small>
                  </div>
                  <span>
                    <CheckIcon size={18} />
                  </span>
                </div>

                <div className="metric teal">
                  <div className="metric-info">
                    <p>Taken Leaves</p>
                    <h2 style={{ color: '#287c78' }}>{empStats.stats.takenLeaveDays ?? 0}</h2>
                    <small>Approved leave days</small>
                  </div>
                  <span>
                    <CalendarIcon size={18} />
                  </span>
                </div>

                <div className="metric red">
                  <div className="metric-info">
                    <p>Rejected</p>
                    <h2 style={{ color: '#d75a67' }}>{empStats.stats.rejectedRequests}</h2>
                    <small>Declined</small>
                  </div>
                  <span>
                    <XIcon size={18} />
                  </span>
                </div>

                <div className="metric teal">
                  <div className="metric-info">
                    <p>Cancelled</p>
                    <h2 style={{ color: '#287c78' }}>{empStats.stats.cancelledRequests}</h2>
                    <small>Withdrawn requests</small>
                  </div>
                  <span>
                    <CalendarIcon size={18} />
                  </span>
                </div>
              </div>

              {/* Recent Applications Table */}
              <section className="panel">
                <div className="panel-head">
                  <div>
                    <h2>Recent Leave Applications</h2>
                    <p>Track status and review decisions on your submissions</p>
                  </div>
                  <Link href="/my-leaves" className="secondary-action">
                    View All History
                  </Link>
                </div>

                {empStats.recentApplications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '36px', color: '#758195' }}>
                    <p style={{ fontWeight: 600, color: '#17223a' }}>No leave applications submitted yet.</p>
                    <Link href="/apply-leave" className="primary" style={{ marginTop: '12px' }}>
                      Submit Your First Request
                    </Link>
                  </div>
                ) : (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>Leave Type</th>
                          <th>Dates</th>
                          <th>Duration</th>
                          <th>Status</th>
                          <th>Decision Authority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empStats.recentApplications.map((r: any) => (
                          <tr key={r.id}>
                            <td>
                              <strong>{r.requestId}</strong>
                            </td>
                            <td>{r.leaveType.replace('_', ' ')}</td>
                            <td>
                              {formatDate(r.startDate)}
                              {r.startDate !== r.endDate ? ` to ${formatDate(r.endDate)}` : ''}
                            </td>
                            <td>{r.numberOfDays} Day(s)</td>
                            <td>
                              <span className={`stage-pill stage-${r.status.toLowerCase()}`}>
                                {r.status}
                              </span>
                            </td>
                            <td>
                              {r.status === 'CANCELLED' ? (
                                <div style={{ fontSize: '11.5px', color: '#758195' }}>
                                  <div style={{ fontWeight: 600 }}>Cancelled by Employee</div>
                                  {r.decidedAt && (
                                    <div style={{ color: '#94A3B8' }}>{formatDate(r.decidedAt)}</div>
                                  )}
                                </div>
                              ) : r.decidedBy ? (
                                <div style={{ fontSize: '11.5px' }}>
                                  <div>{r.decidedBy}</div>
                                  <div style={{ color: '#758195' }}>{formatDate(r.decidedAt)}</div>
                                </div>
                              ) : (
                                <span style={{ color: '#758195', fontSize: '11.5px' }}>Awaiting review</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )
        )}
      </main>

      {/* Decision Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={`${decisionAction === 'APPROVE' ? 'Approve' : 'Reject'} Leave Request`}
        footer={
          <>
            <button className="secondary-action" onClick={() => setSelectedRequest(null)}>
              Cancel
            </button>
            <button
              className="primary"
              style={{
                backgroundColor: decisionAction === 'APPROVE' ? '#1b9e76' : '#d75a67',
              }}
              onClick={handleConfirmDecision}
              disabled={submittingDecision}
            >
              {submittingDecision
                ? 'Processing...'
                : `Confirm ${decisionAction === 'APPROVE' ? 'Approval' : 'Rejection'}`}
            </button>
          </>
        }
      >
        {selectedRequest && (
          <div>
            <div style={{ padding: '14px', background: '#f6f8fb', borderRadius: '6px', border: '1px solid #e8edf3', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <strong style={{ color: '#17223a' }}>{selectedRequest.requestId}</strong>
                <span className="stage-pill stage-pending">PENDING</span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#17223a' }}>
                <strong>Employee:</strong> {selectedRequest.employeeName} ({selectedRequest.employeeId})
              </div>
              <div style={{ fontSize: '12.5px', color: '#17223a' }}>
                <strong>Dates:</strong> {formatDate(selectedRequest.startDate)} to {formatDate(selectedRequest.endDate)} ({selectedRequest.numberOfDays} days)
              </div>
              <div style={{ fontSize: '12.5px', marginTop: '4px', color: '#758195' }}>
                <strong>Reason:</strong> {selectedRequest.reason}
              </div>
            </div>

            {decisionAction === 'REJECT' ? (
              <div className="form-group">
                <label className="form-label">
                  Rejection Remarks <span className="required">*</span>
                </label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  placeholder="Explain why this application is being rejected (sent to employee in notification email)..."
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  onBlur={(e) => setRejectionRemarks(normalizeReasonText(e.target.value))}
                  minLength={3}
                  maxLength={250}
                  autoFocus
                />
                <div className="form-helper">
                  Enter 3–250 characters using letters, numbers, spaces, or basic punctuation.
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: '#17223a' }}>
                Are you sure you want to approve this leave request? The employee will be notified by email.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
