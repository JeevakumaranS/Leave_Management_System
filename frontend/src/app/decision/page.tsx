'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth-context';
import { useToast } from '../../components/Toast';
import { useLiveDataRefresh } from '../../lib/use-live-data-refresh';
import { formatDate, formatDateTime } from '../../lib/date';
import { getReasonTextError, normalizeReasonText } from '../../lib/reason-validation';
import {
  CheckIcon,
  XIcon,
  AlertTriangleIcon,
  ShieldIcon,
  FileTextIcon,
} from '../../components/Icons';

function DecisionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const { success, error } = useToast();

  const token = searchParams.get('token');
  const initialAction = searchParams.get('action'); // 'approve' or 'reject'
  const returnTo = token
    ? `/decision?${new URLSearchParams({
        token,
        action: initialAction?.toLowerCase() === 'reject' ? 'reject' : 'approve',
      }).toString()}`
    : '/decision';
  const loginUrl = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  const [loading, setLoading] = useState(true);
  const [tokenData, setTokenData] = useState<any>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const [action, setAction] = useState<'APPROVE' | 'REJECT'>(
    initialAction?.toLowerCase() === 'reject' ? 'REJECT' : 'APPROVE'
  );
  const [rejectionRemarks, setRejectionRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decidedResult, setDecidedResult] = useState<any>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(loginUrl);
      return;
    }
    if (user.role !== 'HR' && user.role !== 'DIRECTOR') {
      setVerificationError('Only the HR or Director account assigned to this link can review it.');
      setLoading(false);
      return;
    }
    if (!token) {
      setVerificationError('No approval token was provided in the link.');
      setLoading(false);
      return;
    }

    verifyApprovalToken(token);
  }, [token, user, authLoading, loginUrl, router]);

  const verifyApprovalToken = async (tok: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setVerificationError(null);
    }
    try {
      const res = await api.approvals.verifyToken(tok);
      setTokenData(res);
    } catch (err: any) {
      if (silent) throw err;
      setVerificationError(err.message || 'Approval token could not be verified.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveDataRefresh(
    () => (token && !decidedResult ? verifyApprovalToken(token, true) : undefined),
    Boolean(
      token &&
      user &&
      (user.role === 'HR' || user.role === 'DIRECTOR') &&
      !decidedResult &&
      !verificationError &&
      tokenData?.isPending !== false &&
      !tokenData?.isExpired,
    ),
  );

  const handleExecuteDecision = async () => {
    if (!token) return;
    if (action === 'REJECT') {
      const remarksError = getReasonTextError(rejectionRemarks, 'Rejection remarks');
      if (remarksError) {
        error(remarksError);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await api.approvals.decideWithToken({
        token,
        action,
        rejectionRemarks: action === 'REJECT' ? normalizeReasonText(rejectionRemarks) : undefined,
      });

      setDecidedResult(res);
      success(`Leave request ${res.requestId} successfully recorded as ${res.status}.`);
    } catch (err: any) {
      error(err.message || 'Failed to record decision');
      // Re-verify to see if someone else decided in the meantime
      verifyApprovalToken(token);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="decision-page" style={{ minHeight: '100vh', backgroundColor: '#F6F8FB', padding: '40px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="decision-card" style={{ maxWidth: '640px', width: '100%', background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E8EDF3', boxShadow: '0 10px 25px -5px rgba(23,34,58,0.08)', overflow: 'hidden' }}>
        {/* Brand Header */}
        <div className="decision-card-header" style={{ background: '#15213A', color: '#ffffff', padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: '18px', fontWeight: 800, letterSpacing: '0.5px' }}>Employee Leave Decision Authorization Gateway</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.08)', padding: '6px 12px', borderRadius: '20px', fontSize: '11.5px' }}>
            <ShieldIcon size={14} color="#9cb4dd" />
            <span>Secure Token Auth</span>
          </div>
        </div>

        <div className="decision-card-content" style={{ padding: '32px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#7E8798' }}>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>Verifying decision authorization token...</div>
              <div style={{ fontSize: '13px', marginTop: '6px' }}>Connecting to Durozen centralized leave service</div>
            </div>
          ) : verificationError ? (
            /* Error / Invalid Token Screen */
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ width: '56px', height: '56px', background: '#FEECEF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <XIcon size={32} color="#D75A67" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#17223A' }}>Token Authorization Failed</h2>
              <p style={{ fontSize: '14px', color: '#7E8798', marginTop: '8px', maxWidth: '420px', margin: '8px auto 24px' }}>
                {verificationError}
              </p>
              <button
                onClick={() => {
                  logout();
                  router.replace(loginUrl);
                }}
                className="btn btn-primary"
              >
                Sign in with the authorized approver account
              </button>
            </div>
          ) : decidedResult ? (
            /* Decision Success Screen */
            <div style={{ textAlign: 'center', padding: '32px 16px' }}>
              <div style={{ width: '56px', height: '56px', background: decidedResult.status === 'APPROVED' ? '#E3F7F0' : '#FEECEF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                {decidedResult.status === 'APPROVED' ? (
                  <CheckIcon size={32} color="#1B9E76" />
                ) : (
                  <XIcon size={32} color="#D75A67" />
                )}
              </div>
              <h2 style={{ fontSize: '22px', fontWeight: 800, color: '#17223A' }}>
                Decision Recorded: {decidedResult.status}
              </h2>
              <p style={{ fontSize: '14px', color: '#17223A', marginTop: '8px' }}>
                Leave Request <strong>{decidedResult.requestId}</strong> has been finalized.
              </p>

              <div style={{ background: '#F6F8FB', padding: '16px', borderRadius: '8px', border: '1px solid #E8EDF3', margin: '24px 0', textAlign: 'left', fontSize: '13px' }}>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Employee:</strong> {decidedResult.employeeName} ({decidedResult.employeeId})
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Decision Authority:</strong> {decidedResult.decidedBy}
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>Timestamp:</strong> {formatDateTime(decidedResult.decidedAt)}
                </div>
              </div>

              <button onClick={() => router.push('/dashboard')} className="btn btn-primary">
                Go to Management Dashboard
              </button>
            </div>
          ) : !tokenData?.isPending ? (
            /* Already Decided Notice (SRS 5.1 & TC-13) */
            <div style={{ textAlign: 'center', padding: '24px 16px' }}>
              <div style={{ width: '56px', height: '56px', background: '#FFF4DF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <AlertTriangleIcon size={32} color="#D49422" />
              </div>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#17223A' }}>
                Action Rejected: Request Already Decided
              </h2>
              <p style={{ fontSize: '13.5px', color: '#7E8798', marginTop: '8px', lineHeight: 1.5 }}>
                Per Durozen Leave Policy, the first valid decision by either Director or HR becomes final.
              </p>

              <div style={{ background: '#F6F8FB', padding: '16px', borderRadius: '8px', border: '1px solid #E8EDF3', margin: '20px 0', textAlign: 'left', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <strong>Request ID: {tokenData.request.requestId}</strong>
                  <span className={`badge badge-${tokenData.decisionStatus.toLowerCase()}`}>
                    {tokenData.decisionStatus}
                  </span>
                </div>
                <div><strong>Decided By:</strong> {tokenData.alreadyDecidedBy || 'Administrator'}</div>
                <div><strong>Decision Timestamp:</strong> {tokenData.decidedAt ? formatDateTime(tokenData.decidedAt) : 'Recorded'}</div>
                {tokenData.request.rejectionRemarks && (
                  <div style={{ marginTop: '6px', color: '#D75A67' }}>
                    <strong>Remarks:</strong> {tokenData.request.rejectionRemarks}
                  </div>
                )}
              </div>

              <button onClick={() => router.push('/dashboard')} className="btn btn-secondary">
                View Management Portal
              </button>
            </div>
          ) : (
            /* Pending Decision Form */
            <div>
              <div style={{ marginBottom: '20px' }}>
                <span className="badge badge-pending" style={{ marginBottom: '8px' }}>
                  AWAITING DECISION
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#17223A' }}>
                  Review Leave Request: {tokenData.request.requestId}
                </h2>
                <p style={{ fontSize: '13px', color: '#7E8798', marginTop: '4px' }}>
                  Authorized Approver: <strong>{tokenData.approverEmail}</strong>
                </p>
              </div>

              {/* Request Details Table */}
              <div className="decision-request-details" style={{ background: '#F6F8FB', padding: '16px', borderRadius: '8px', border: '1px solid #E8EDF3', marginBottom: '24px' }}>
                <table style={{ width: '100%', fontSize: '13px' }}>
                  <tbody>
                    <tr>
                      <th style={{ width: '38%', padding: '6px 0', color: '#7E8798' }}>Employee</th>
                      <td style={{ fontWeight: 600 }}>
                        {tokenData.request.employeeName} ({tokenData.request.employeeId})
                      </td>
                    </tr>
                    <tr>
                      <th style={{ padding: '6px 0', color: '#7E8798' }}>Corporate Email</th>
                      <td>{tokenData.request.employeeEmail}</td>
                    </tr>
                    <tr>
                      <th style={{ padding: '6px 0', color: '#7E8798' }}>Leave Category</th>
                      <td style={{ fontWeight: 600 }}>
                        {tokenData.request.leaveType.replace('_', ' ')}
                        {tokenData.request.otherNote && ` (${tokenData.request.otherNote})`}
                      </td>
                    </tr>
                    <tr>
                      <th style={{ padding: '6px 0', color: '#7E8798' }}>Dates & Duration</th>
                      <td>
                        {formatDate(tokenData.request.startDate)} to {formatDate(tokenData.request.endDate)} •{' '}
                        <strong>{tokenData.request.numberOfDays} Day(s)</strong> ({tokenData.request.duration.replace(/_/g, ' ')})
                      </td>
                    </tr>
                    <tr>
                      <th style={{ padding: '6px 0', color: '#7E8798' }}>Reason for Leave</th>
                      <td>{tokenData.request.reason}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Decision Toggle with Status Colors */}
              <div className="form-group">
                <label className="form-label">Select Your Decision Action:</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setAction('APPROVE')}
                    className="btn"
                    style={{
                      padding: '12px',
                      backgroundColor: action === 'APPROVE' ? '#1B9E76' : '#FFFFFF',
                      color: action === 'APPROVE' ? '#FFFFFF' : '#1B9E76',
                      border: '2px solid #1B9E76',
                      fontWeight: 700,
                    }}
                  >
                    <CheckIcon size={18} /> APPROVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('REJECT')}
                    className="btn"
                    style={{
                      padding: '12px',
                      backgroundColor: action === 'REJECT' ? '#D75A67' : '#FFFFFF',
                      color: action === 'REJECT' ? '#FFFFFF' : '#D75A67',
                      border: '2px solid #D75A67',
                      fontWeight: 700,
                    }}
                  >
                    <XIcon size={18} /> REJECT
                  </button>
                </div>
              </div>

              {/* Rejection remarks field (SRS 6.3) */}
              {action === 'REJECT' && (
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">
                    Rejection Remarks <span className="required">*</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Enter explicit reason for rejecting this leave request (mandatory)..."
                    value={rejectionRemarks}
                    onChange={(e) => setRejectionRemarks(e.target.value)}
                    onBlur={(e) => setRejectionRemarks(normalizeReasonText(e.target.value))}
                    minLength={3}
                    maxLength={250}
                    autoFocus
                  />
                  <div className="form-helper">
                    Enter 3–250 characters using letters, numbers, spaces, or basic punctuation.
                    Rejection remarks will be recorded in the audit trail and emailed to the employee.
                  </div>
                </div>
              )}

              {/* Critical Security Warning */}
              <div style={{ padding: '12px', background: '#E9F1FF', borderRadius: '6px', borderLeft: '4px solid #2869DC', fontSize: '12px', color: '#2869DC', margin: '20px 0', lineHeight: 1.5 }}>
                <strong>CRITICAL SECURITY & WORKFLOW NOTICE:</strong> Confirming this decision will update the leave request and permanently finalize the decision for both approvers.
              </div>

              <button
                type="button"
                onClick={handleExecuteDecision}
                className={`btn btn-lg ${action === 'APPROVE' ? 'btn-success' : 'btn-danger'}`}
                style={{ width: '100%' }}
                disabled={submitting}
              >
                {submitting
                  ? 'Recording Decision...'
                  : `Confirm & Record ${action === 'APPROVE' ? 'Approval' : 'Rejection'}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DecisionPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#7E8798' }}>Loading decision portal...</div>}>
      <DecisionContent />
    </Suspense>
  );
}
