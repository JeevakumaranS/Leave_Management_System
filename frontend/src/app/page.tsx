'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth-context';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, background: '#2769d7', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, margin: '0 auto 16px', fontSize: 20 }}>
          D
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#15213a' }}>DUROZEN TECHNOLOGIES</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Loading Leave Management System...</div>
      </div>
    </div>
  );
}
