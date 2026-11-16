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
import { formatDateTime } from '../../../lib/date';
import { useLiveDataRefresh } from '../../../lib/use-live-data-refresh';
import {
  BellIcon,
  RefreshIcon,
  CheckIcon,
  XIcon,
} from '../../../components/Icons';

export default function NotificationsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

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
      loadLogs(page);
    }
  }, [user, authLoading, isAdmin, page]);

  const loadLogs = async (targetPage = page, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.notifications.getLogs({ page: targetPage, limit: PAGE_SIZE });
      setLogs(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err: any) {
      if (silent) throw err;
      error(err.message || 'Failed to load notification audit trail');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useLiveDataRefresh(() => loadLogs(page, true), Boolean(user && isAdmin));

  const handleRetry = async (id: string) => {
    setRetryingId(id);
    try {
      const result = await api.notifications.retry(id);
      if (result.deliveryStatus === 'SENT') {
        success('Email notification resent successfully.');
      } else {
        error(result.errorMessage || 'Email retry failed.');
      }
      await loadLogs();
    } catch (err: any) {
      error(err.message || 'Retry failed');
    } finally {
      setRetryingId(null);
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
              <h1 className="page-title">Automated Email Notification Audit Logs</h1>
              <p className="page-subtitle">
                Complete delivery tracking for leave requests, Director/HR notifications, and employee approval emails
              </p>
            </div>

            <button onClick={() => loadLogs()} className="btn btn-secondary btn-sm" title="Refresh">
              <RefreshIcon size={14} /> Refresh Logs
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: '#64748b' }}>Loading notification logs...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <p style={{ fontWeight: 600 }}>No notifications recorded yet.</p>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Log ID</th>
                    <th>Related Request</th>
                    <th>Recipient</th>
                    <th>Notification Event</th>
                    <th>Delivery Status</th>
                    <th>Sent Timestamp</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <strong style={{ color: '#15213a' }}>{log.notificationId}</strong>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{log.requestId}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{log.recipientEmail}</div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>Role: {log.recipientRole || 'User'}</div>
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            backgroundColor:
                              log.notificationType === 'REQUEST'
                                ? '#fef3c7'
                                : log.notificationType === 'APPROVAL'
                                ? '#dcfce7'
                                : '#fee2e2',
                            color:
                              log.notificationType === 'REQUEST'
                                ? '#b45309'
                                : log.notificationType === 'APPROVAL'
                                ? '#15803d'
                                : '#b91c1c',
                          }}
                        >
                          {log.notificationType}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${log.deliveryStatus.toLowerCase() === 'sent' ? 'approved' : 'rejected'}`}>
                          {log.deliveryStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {formatDateTime(log.sentAt)}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="btn btn-secondary btn-sm"
                          >
                            Inspect Preview
                          </button>
                          {log.deliveryStatus === 'FAILED' && (
                            <button
                              onClick={() => handleRetry(log.id)}
                              className="btn btn-primary btn-sm"
                              disabled={retryingId === log.id}
                            >
                              {retryingId === log.id ? 'Retrying...' : 'Retry'}
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
          {!loading && logs.length > 0 && (
            <PaginationControls currentPage={page} totalItems={total} onPageChange={setPage} />
          )}
        </main>
      </div>

      {/* Inspect Notification Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Notification Log - ${selectedLog?.notificationId}`}
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLog(null)}>
            Close
          </button>
        }
      >
        {selectedLog && (
          <div>
            <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <strong>{selectedLog.subject}</strong>
                <span className={`badge ${selectedLog.deliveryStatus === 'SENT' ? 'badge-approved' : 'badge-rejected'}`}>
                  {selectedLog.deliveryStatus}
                </span>
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b' }}>
                <strong>To:</strong> {selectedLog.recipientEmail} ({selectedLog.recipientRole}) • <strong>Request ID:</strong> {selectedLog.requestId}
              </div>
              <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '4px' }}>
                <strong>Timestamp:</strong> {formatDateTime(selectedLog.sentAt)}
              </div>
            </div>

            {selectedLog.errorMessage && (
              <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '6px', border: '1px solid #fecaca', marginBottom: '16px', color: '#b91c1c', fontSize: '13px' }}>
                <strong>Delivery error:</strong> {selectedLog.errorMessage}
              </div>
            )}

            <div style={{ marginBottom: '16px' }}>
              <label className="form-label">Message Content Summary:</label>
              <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', lineHeight: 1.5, color: '#334155' }}>
                {selectedLog.bodyPreview || 'Full HTML template delivered via transaction pipeline.'}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
