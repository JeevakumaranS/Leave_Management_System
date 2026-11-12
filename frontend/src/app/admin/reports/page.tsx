'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import { Sidebar } from '../../../components/Sidebar';
import { Navbar } from '../../../components/Navbar';
import {
  ChartIcon,
  DownloadIcon,
  RefreshIcon,
  UsersIcon,
  CheckIcon,
} from '../../../components/Icons';

export default function ReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { error } = useToast();

  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'EMPLOYEE' | 'MONTHLY' | 'TYPE'>('EMPLOYEE');

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
      loadAnalytics();
    }
  }, [user, authLoading, isAdmin]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const data = await api.reports.getAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      error(err.message || 'Failed to load leave analytics');
    } finally {
      setLoading(false);
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
              <h1 className="page-title">Reports & Executive Analytics</h1>
              <p className="page-subtitle">
                Company-wide leave utilization breakdowns, monthly trends, and CSV reporting (SRS Section 9)
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={loadAnalytics} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshIcon size={14} /> Refresh
              </button>
              {/* Teal accented action button */}
              <a
                href={api.reports.exportCsvUrl()}
                target="_blank"
                rel="noreferrer"
                className="btn btn-teal btn-sm"
              >
                <DownloadIcon size={16} /> Export All Leaves (CSV)
              </a>
            </div>
          </div>

          {/* Navigation Tabs with Teal Accents */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid #E8EDF3', paddingBottom: '12px' }}>
            <button
              onClick={() => setActiveTab('EMPLOYEE')}
              className={`btn btn-sm ${activeTab === 'EMPLOYEE' ? 'btn-teal' : 'btn-secondary'}`}
            >
              Employee-Wise Usage
            </button>
            <button
              onClick={() => setActiveTab('MONTHLY')}
              className={`btn btn-sm ${activeTab === 'MONTHLY' ? 'btn-teal' : 'btn-secondary'}`}
            >
              Monthly Distribution
            </button>
            <button
              onClick={() => setActiveTab('TYPE')}
              className={`btn btn-sm ${activeTab === 'TYPE' ? 'btn-teal' : 'btn-secondary'}`}
            >
              Leave Categories
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: 'center', padding: '48px' }}>
              <div style={{ color: '#7E8798' }}>Calculating aggregate reports...</div>
            </div>
          ) : !analytics ? (
            <div className="card">No report data available.</div>
          ) : (
            <>
              {/* TAB 1: EMPLOYEE WISE SUMMARY */}
              {activeTab === 'EMPLOYEE' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Employee-Wise Leave Quota & History Breakdown</h2>
                      <p className="card-subtitle">
                        Per SRS 9: Approved days are counted against quota; rejected and cancelled requests are not counted.
                      </p>
                    </div>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Employee ID</th>
                          <th>Full Name</th>
                          <th>Department</th>
                          <th>Annual Quota</th>
                          <th>Used Days</th>
                          <th>Remaining Balance</th>
                          <th>Approved</th>
                          <th>Pending</th>
                          <th>Rejected</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.employeeSummary.map((e: any) => (
                          <tr key={e.employeeId}>
                            <td>
                              <strong style={{ color: '#17223A' }}>{e.employeeId}</strong>
                            </td>
                            <td>{e.name}</td>
                            <td>{e.department}</td>
                            <td>{e.annualQuota} Days</td>
                            <td>
                              <span style={{ fontWeight: 700, color: e.usedDays > 8 ? '#D75A67' : '#17223A' }}>
                                {e.usedDays} Days
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-approved" style={{ fontSize: '12px' }}>
                                {e.remainingDays} Days Left
                              </span>
                            </td>
                            <td>
                              <span style={{ color: '#1B9E76', fontWeight: 600 }}>{e.approvedCount}</span>
                            </td>
                            <td>
                              <span style={{ color: '#D49422', fontWeight: 600 }}>{e.pendingCount}</span>
                            </td>
                            <td>
                              <span style={{ color: '#D75A67', fontWeight: 600 }}>{e.rejectedCount}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: MONTHLY TRENDS */}
              {activeTab === 'MONTHLY' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Monthly Leave Application Trajectory ({new Date().getFullYear()})</h2>
                      <p className="card-subtitle">Monthly breakdown of submitted, approved and rejected requests</p>
                    </div>
                  </div>

                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Total Submitted</th>
                          <th>Approved</th>
                          <th>Rejected</th>
                          <th>Pending</th>
                          <th>Approval Ratio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.monthlyTrends.map((m: any) => {
                          const ratio =
                            m.total > 0 ? Math.round((m.approved / m.total) * 100) : 0;
                          return (
                            <tr key={m.monthIndex}>
                              <td>
                                <strong>{m.month}</strong>
                              </td>
                              <td>{m.total}</td>
                              <td>
                                <span style={{ color: '#1B9E76', fontWeight: 600 }}>{m.approved}</span>
                              </td>
                              <td>
                                <span style={{ color: '#D75A67', fontWeight: 600 }}>{m.rejected}</span>
                              </td>
                              <td>
                                <span style={{ color: '#D49422', fontWeight: 600 }}>{m.pending}</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{ flex: 1, maxWidth: '100px', height: '6px', background: '#E8EDF3', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${ratio}%`, height: '100%', background: '#1B9E76' }} />
                                  </div>
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#1B9E76' }}>{ratio}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: LEAVE TYPE DISTRIBUTION */}
              {activeTab === 'TYPE' && (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Approved Leave Utilization by Category</h2>
                      <p className="card-subtitle">Breakdown of days taken by leave type (Casual, Sick, Emergency, Other)</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                    {Object.entries(analytics.leaveTypeDistribution).map(([type, data]: [string, any], idx) => {
                      const colors = ['#2769D7', '#287C78', '#D49422', '#1B9E76'];
                      const curColor = colors[idx % colors.length];
                      return (
                        <div
                          key={type}
                          style={{
                            padding: '20px',
                            border: '1px solid #E8EDF3',
                            borderRadius: '8px',
                            backgroundColor: '#FFFFFF',
                            boxShadow: '0 1px 3px rgba(23,34,58,0.05)',
                          }}
                        >
                          <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#7E8798', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            {type.replace('_', ' ')}
                          </div>
                          <div style={{ fontSize: '28px', fontWeight: 800, color: curColor, marginTop: '8px' }}>
                            {data.totalDays} <span style={{ fontSize: '14px', color: '#7E8798', fontWeight: 500 }}>Days</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#7E8798', marginTop: '4px' }}>
                            Across <strong>{data.count}</strong> approved applications
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
