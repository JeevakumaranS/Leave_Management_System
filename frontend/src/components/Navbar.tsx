'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';
import { useToast } from './Toast';

export const Navbar: React.FC = () => {
  const router = useRouter();
  const { user, quickLogin, logout } = useAuth();
  const { success } = useToast();

  const handlePersonaSwitch = async (role: 'DIRECTOR' | 'HR' | 'EMPLOYEE') => {
    try {
      await quickLogin(role);
      success(`Switched active persona to ${role}`);
      router.push('/dashboard');
    } catch {
      // Handled
    }
  };

  return (
    <div className="top-action-bar">
      <div className="portal-label">
        DUROZEN TECHNOLOGIES • <strong>leave.durozen.in</strong>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Quick Demo Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#758195', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Role Switch:
          </span>
          <div className="persona-switcher">
            <button
              type="button"
              onClick={() => handlePersonaSwitch('DIRECTOR')}
              className={`persona-btn ${user?.role === 'DIRECTOR' ? 'active' : ''}`}
            >
              Director
            </button>
            <button
              type="button"
              onClick={() => handlePersonaSwitch('HR')}
              className={`persona-btn ${user?.role === 'HR' ? 'active' : ''}`}
            >
              HR Admin
            </button>
            <button
              type="button"
              onClick={() => handlePersonaSwitch('EMPLOYEE')}
              className={`persona-btn ${user?.role === 'EMPLOYEE' ? 'active' : ''}`}
            >
              Employee
            </button>
          </div>
        </div>

        {/* Leave Balance Indicator */}
        {user?.role === 'EMPLOYEE' && user.remainingQuota !== undefined && (
          <div
            style={{
              background: '#e9f1ff',
              padding: '4px 10px',
              borderRadius: '4px',
              border: '1px solid #d2e4ff',
              fontSize: '11.5px',
              color: '#2869dc',
              fontWeight: 700,
            }}
          >
            Balance: {user.remainingQuota} / {user.annualQuota} Days
          </div>
        )}
      </div>
    </div>
  );
};
