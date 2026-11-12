'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Sidebar } from '../../components/Sidebar';
import { Navbar } from '../../components/Navbar';
import { Modal } from '../../components/Modal';
import { CalendarIcon, RefreshIcon } from '../../components/Icons';

export default function CalendarPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { error } = useToast();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: Date; events: any[] } | null>(null);

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    if (user) {
      loadCalendarLeaves();
    }
  }, [user, authLoading, month, year]);

  const loadCalendarLeaves = async () => {
    setLoading(true);
    try {
      const data = await api.leaves.getCalendar(month + 1, year);
      setLeaves(data);
    } catch (err: any) {
      error('Failed to load leave calendar');
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Build grid calendar days
  const calendarDays = () => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];

    // Prev month days padding
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevMonthDays - i,
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      days.push({
        day: d,
        date: new Date(year, month, d),
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill row of 7
    const remaining = (7 - (days.length % 7)) % 7;
    for (let j = 1; j <= remaining; j++) {
      days.push({
        day: j,
        date: new Date(year, month + 1, j),
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const getEventsForDay = (date: Date) => {
    const checkTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    return leaves.filter((l) => {
      const s = new Date(l.startDate);
      const sTime = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
      const e = new Date(l.endDate);
      const eTime = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
      return checkTime >= sTime && checkTime <= eTime;
    });
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar />

        <main className="page-container">
          <div className="page-header">
            <div>
              <h1 className="page-title">Company Leave Calendar</h1>
              <p className="page-subtitle">
                Scheduled and approved employee absences across Durozen Technologies
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button onClick={loadCalendarLeaves} className="btn btn-secondary btn-sm" title="Refresh">
                <RefreshIcon size={14} /> Refresh
              </button>
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
                <button onClick={handlePrevMonth} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}>
                  &lt; Prev
                </button>
                <button onClick={handleToday} className="btn btn-secondary btn-sm" style={{ padding: '4px 12px', fontWeight: 700 }}>
                  Today
                </button>
                <button onClick={handleNextMonth} className="btn btn-secondary btn-sm" style={{ padding: '4px 10px' }}>
                  Next &gt;
                </button>
              </div>
            </div>
          </div>

          <div className="card calendar-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#15213a' }}>
                {monthNames[month]} {year}
              </h2>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Total <strong>{leaves.length}</strong> approved leave periods in {monthNames[month]}
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
                Loading calendar schedule...
              </div>
            ) : (
              <div className="calendar-grid">
                {dayNames.map((d) => (
                  <div key={d} className="calendar-header-cell">
                    {d}
                  </div>
                ))}

                {calendarDays().map((cell, idx) => {
                  const events = getEventsForDay(cell.date);
                  const isToday =
                    cell.date.toDateString() === new Date().toDateString();

                  return (
                    <div
                      key={idx}
                      className={`calendar-day-cell ${!cell.isCurrentMonth ? 'other-month' : ''}`}
                      style={{
                        backgroundColor: isToday ? '#eff6ff' : undefined,
                        cursor: events.length > 0 ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (events.length > 0) {
                          setSelectedDayEvents({ date: cell.date, events });
                        }
                      }}
                    >
                      <div
                        className="calendar-day-number"
                        style={{
                          color: isToday ? '#2563eb' : cell.isCurrentMonth ? '#15213a' : '#94a3b8',
                        }}
                      >
                        {cell.day}
                        {isToday && (
                          <span style={{ fontSize: '10px', marginLeft: '4px', color: '#2563eb' }}>
                            (Today)
                          </span>
                        )}
                      </div>

                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        {events.slice(0, 3).map((e) => (
                          <div
                            key={e.id}
                            className="calendar-event-pill"
                            title={`${e.employeeName} (${e.leaveType.replace('_', ' ')})`}
                          >
                            {e.employeeName.split(' ')[0]}: {e.leaveType.replace('_', ' ')}
                          </div>
                        ))}
                        {events.length > 3 && (
                          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                            +{events.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Selected Day Events Modal */}
      <Modal
        isOpen={!!selectedDayEvents}
        onClose={() => setSelectedDayEvents(null)}
        title={selectedDayEvents ? `Leaves on ${selectedDayEvents.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}` : ''}
        footer={
          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedDayEvents(null)}>
            Close
          </button>
        }
      >
        {selectedDayEvents && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedDayEvents.events.map((e) => (
                <div
                  key={e.id}
                  style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <strong style={{ color: '#15213a' }}>{e.employeeName}</strong>
                    <span className="badge badge-approved">APPROVED</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    <strong>ID:</strong> {e.employeeId} • <strong>Type:</strong> {e.leaveType.replace('_', ' ')}
                  </div>
                  <div style={{ fontSize: '12px', color: '#475569' }}>
                    <strong>Duration:</strong> {e.numberOfDays} Day(s) ({e.duration.replace(/_/g, ' ')})
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                    <strong>Period:</strong> {new Date(e.startDate).toLocaleDateString()} to {new Date(e.endDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
