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
  ClockIcon,
  CheckIcon,
  XIcon,
  RefreshIcon,
  AlertTriangleIcon,
} from '../../../components/Icons';

export default function PendingApprovalsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Decision Modal
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [decisionAction, setDecisionAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
      loadPendingLeaves();
    }
  }, [user, authLoading, isAdmin]);

  const loadPendingLeaves = async () => {
    setLoading(true);
    try {
      const res = await api.leaves.getAll({ status: 'PENDING' });
      setPendingLeaves(res.items);
    } catch (err: any) {
      error(err.message || 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDecision = (req: any, action: 'APPROVE' | 'REJECT') => {
    setSelectedRequest(req);
    setDecisionAction(action);
    setRejectionRemarks('');
  };

  const handleConfirmDecision = async () => {
    if (!selectedRequest) return;
    if (decisionAction === 'REJECT' && !rejectionRemarks.trim()) {
      error('Rejection remarks are mandatory to explain why the leave is rejected (SRS 6.3).');
      return;
    }

    setSubmitting(true);
    try {
      await api.approvals.decidePortal(selectedRequest.requestId, {
        action: decisionAction,
        rejectionRemarks: decisionAction === 'REJECT' ? rejectionRemarks : undefined,
      });

      success(
        `Leave request ${selectedRequest.requestId} was successfully ${
          decisionAction === 'APPROVE' ? 'APPROVED' : 'REJECTED'
        }! Notification email sent.`,
      );
      setSelectedRequest(null);
      loadPendingLeaves();
    } catch (err: any) {
      error(err.message || 'Failed to record approval decision');
    } finally {
      setSubmitting(false);
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
              <h1 className="page-title">Pending Leave Approvals Queue</h1>
              <p className="page-subtitle">
                Review and record atomic decisions. First decision by either Director or HR becomes final.
              </p>
            </div>

            <button onClick={loadPendingLeaves} className="btn btn-secondary btn-sm" title="Refresh">
              <RefreshIcon size={14} /> Refresh Queue
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: '#64748b' }}>Loading pending leave applications...</div>
            </div>
          ) : pendingLeaves.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '60px' }}>
              <CheckIcon size={44} color="#16a34a" style={{ margin: '0 auto 16px', display: 'block' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#15213a' }}>No Pending Applications</h3>
              <p style={{ fontSize: '13.5px', color: '#64748b', marginTop: '6px' }}>
                All submitted leave requests have been reviewed and decided.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Request ID</th>
                    <th>Employee Details</th>
                    <th>Leave Type</th>
                    <th>Duration & Dates</th>
                    <th>Reason</th>
                    <th>Submission Time</th>
                    <th style={{ textAlign: 'right' }}>Decision Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingLeaves.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <strong style={{ color: '#15213a' }}>{l.requestId}</strong>
                        <div>
                          <span className="badge badge-pending" style={{ fontSize: '10px' }}>PENDING</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.employeeName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          ID: {l.employeeId} • {l.employeeEmail}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{l.leaveType.replace('_', ' ')}</span>
                        {l.otherNote && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Note: {l.otherNote}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {l.numberOfDays} Day{l.numberOfDays > 1 ? 's' : ''} ({l.duration.replace(/_/g, ' ')})
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(l.startDate).toLocaleDateString()}
                          {l.startDate !== l.endDate ? ` to ${new Date(l.endDate).toLocaleDateString()}` : ''}
                        </div>
                      </td>
                      <td style={{ maxWidth: '280px' }}>
                        <div style={{ fontSize: '13px', lineHeight: 1.4 }}>{l.reason}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(l.submittedAt).toLocaleString()}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            onClick={() => handleOpenDecision(l, 'APPROVE')}
                            className="btn btn-success btn-sm"
                          >
                            <CheckIcon size={14} /> Approve
                          </button>
                          <button
                            onClick={() => handleOpenDecision(l, 'REJECT')}
                            className="btn btn-danger btn-sm"
                          >
                            <XIcon size={14} /> Reject
                          </button>
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

      {/* Decision Modal */}
      <Modal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        title={`${decisionAction === 'APPROVE' ? 'Approve' : 'Reject'} Leave Request - ${selectedRequest?.requestId}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setSelectedRequest(null)}>
              Cancel
            </button>
            <button
              className={`btn ${decisionAction === 'APPROVE' ? 'btn-success' : 'btn-danger'}`}
              onClick={handleConfirmDecision}
              disabled={submitting}
            >
              {submitting
                ? 'Processing...'
                : `Confirm ${decisionAction === 'APPROVE' ? 'Approval' : 'Rejection'}`}
            </button>
          </>
        }
      >
        {selectedRequest && (
          <div>
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <strong style={{ fontSize: '15px', color: '#15213a' }}>{selectedRequest.requestId}</strong>
                <span className="badge badge-pending">PENDING</span>
              </div>
              <div style={{ fontSize: '13px', color: '#334155' }}>
                <strong>Employee:</strong> {selectedRequest.employeeName} ({selectedRequest.employeeId})
              </div>
              <div style={{ fontSize: '13px', color: '#334155' }}>
                <strong>Dates:</strong> {new Date(selectedRequest.startDate).toLocaleDateString()} to {new Date(selectedRequest.endDate).toLocaleDateString()} ({selectedRequest.numberOfDays} days)
              </div>
              <div style={{ fontSize: '13px', color: '#334155', marginTop: '6px' }}>
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
                  placeholder="Provide explicit reason for rejecting this request (included in employee notification email)..."
                  value={rejectionRemarks}
                  onChange={(e) => setRejectionRemarks(e.target.value)}
                  autoFocus
                />
                <div className="form-helper">
                  Required per SRS Section 6.3 & 6.5.
                </div>
              </div>
            ) : (
              <div style={{ fontSize: '13.5px', color: '#334155' }}>
                <p>
                  You are deciding this request as <strong>{user?.name} ({user?.role})</strong>.
                </p>
                <p style={{ marginTop: '8px', color: '#64748b' }}>
                  Upon approval, the employee&apos;s leave balance will be updated and an automated approval email will be sent to <strong>{selectedRequest.employeeEmail}</strong>.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
