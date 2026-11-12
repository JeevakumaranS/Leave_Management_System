'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { useToast } from '../../components/Toast';

export default function LoginPage() {
  const router = useRouter();
  const { login, quickLogin } = useAuth();
  const { success, error } = useToast();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password.trim()) {
      error('Please enter your Employee ID / Email and password');
      return;
    }

    setLoading(true);
    try {
      await login(identifier, password);
      success('Logged in successfully');
      router.push('/dashboard');
    } catch (err: any) {
      error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (role: 'DIRECTOR' | 'HR' | 'EMPLOYEE') => {
    setLoading(true);
    try {
      await quickLogin(role);
      success(`Logged in as ${role}`);
      router.push('/dashboard');
    } catch (err: any) {
      error(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Brand Panel */}
      <div
        className="login-brand-panel"
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 44, height: 44, background: '#2769D7', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 22 }}>
              D
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.5px' }}>DUROZEN TECHNOLOGIES</div>
              <div style={{ fontSize: 12, color: '#9cb4dd' }}>Private Limited</div>
            </div>
          </div>

          <div className="login-hero">
            <span style={{ display: 'inline-block', padding: '4px 12px', background: 'rgba(39, 105, 215, 0.22)', color: '#A8CBFD', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '16px' }}>
              Employee Leave Management System
            </span>
            <h1 style={{ fontSize: '32px', fontWeight: 800, lineHeight: 1.25, marginBottom: '16px' }}>
              Centralized Corporate Leave Platform
            </h1>
            <p style={{ color: '#bdc8da', fontSize: '14px', lineHeight: 1.6 }}>
              Automated leave requests, Director and HR approval workflows, instant notifications, leave tracking, and executive reports.
            </p>
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '24px', fontSize: '12px', color: '#7E8798' }}>
          Internal URL: <strong>leave.durozen.in</strong> • Durozen Internal Portal
        </div>
      </div>

      {/* Right Login Form */}
      <div className="login-form-panel">
        <div className="login-form-content">
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#17223A' }}>Sign In</h2>
            <p style={{ fontSize: '13px', color: '#7E8798', marginTop: '6px' }}>
              Enter your credentials to access your leave account
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-identifier">Employee ID or Corporate Email</label>
              <input
                id="login-identifier"
                type="text"
                className="form-input"
                placeholder="e.g. EMP-101 or hr@durozen.in"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                required
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Sign In to Portal'}
            </button>
          </form>

          {/* Quick Demo Switcher Cards */}
          <div style={{ marginTop: '36px', paddingTop: '24px', borderTop: '1px solid #E8EDF3' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#7E8798', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
              One-Click Role Demonstration
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => handleQuick('DIRECTOR')}
                disabled={loading}
                className="login-role-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E8EDF3',
                  borderRadius: '6px',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#17223A', fontSize: '13px' }}>Director Administrator</div>
                  <div style={{ fontSize: '11.5px', color: '#7E8798' }}>director@durozen.in (Executive Approval & Reports)</div>
                </div>
                <span className="badge badge-pending" style={{ fontSize: '11px' }}>Executive</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('HR')}
                disabled={loading}
                className="login-role-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E8EDF3',
                  borderRadius: '6px',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#17223A', fontSize: '13px' }}>HR Administrator</div>
                  <div style={{ fontSize: '11.5px', color: '#7E8798' }}>hr@durozen.in (Directory, Approvals, Reports)</div>
                </div>
                <span className="badge badge-approved" style={{ fontSize: '11px' }}>HR Admin</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuick('EMPLOYEE')}
                disabled={loading}
                className="login-role-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#FFFFFF',
                  border: '1px solid #E8EDF3',
                  borderRadius: '6px',
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, color: '#17223A', fontSize: '13px' }}>Sarah Jenkins</div>
                  <div style={{ fontSize: '11.5px', color: '#7E8798' }}>sarah.jenkins@durozen.in (EMP-101 • Apply & History)</div>
                </div>
                <span className="badge badge-info" style={{ fontSize: '11px' }}>Employee</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
