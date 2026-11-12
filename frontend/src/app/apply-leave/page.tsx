'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Sidebar } from '../../components/Sidebar';
import { Navbar } from '../../components/Navbar';
import { CheckIcon, AlertTriangleIcon, PlusIcon } from '../../components/Icons';

export default function ApplyLeavePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { success, error } = useToast();

  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedEmpName, setSelectedEmpName] = useState('');
  const [selectedEmpEmail, setSelectedEmpEmail] = useState('');
  const [managerEmail, setManagerEmail] = useState('director@durozen.in');
  const [leaveType, setLeaveType] = useState('CASUAL_LEAVE');
  const [otherNote, setOtherNote] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('FULL_DAY');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }

    loadActiveEmployees();
  }, [user, authLoading]);

  const loadActiveEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const list = await api.employees.getActive();
      setActiveEmployees(list);

      // Pre-select current logged in user if active in list
      if (user) {
        const found = list.find((e: any) => e.employeeId === user.employeeId);
        if (found) {
          selectEmployeeRecord(found);
        } else if (list.length > 0) {
          selectEmployeeRecord(list[0]);
        }
      }
    } catch (err: any) {
      error('Failed to load active employees list');
    } finally {
      setLoadingEmployees(false);
    }
  };

  // SRS 4.2: Selecting either ID or Name populates the corresponding field & email
  const selectEmployeeRecord = (emp: any) => {
    if (!emp) return;
    setSelectedEmpId(emp.employeeId);
    setSelectedEmpName(emp.name);
    setSelectedEmpEmail(emp.email);
  };

  const handleIdChange = (id: string) => {
    const found = activeEmployees.find((e) => e.employeeId === id);
    if (found) {
      selectEmployeeRecord(found);
    }
  };

  const handleNameChange = (name: string) => {
    const found = activeEmployees.find((e) => e.name === name);
    if (found) {
      selectEmployeeRecord(found);
    }
  };

  // SRS 4.5: Date and Duration Validation rules
  const validationErrors = useMemo(() => {
    const errors: string[] = [];

    if (!selectedEmpId) errors.push('Employee ID is mandatory.');
    if (!selectedEmpName) errors.push('Employee Name is mandatory.');
    if (!selectedEmpEmail) errors.push('Employee Email is mandatory.');
    if (!managerEmail) errors.push('Manager Email is mandatory.');
    if (!leaveType) errors.push('Leave Type is mandatory.');

    // SRS 4.4: Other Leave Note mandatory only when Other is selected
    if (leaveType === 'OTHER' && !otherNote.trim()) {
      errors.push('Other Leave Note is mandatory when Leave Type is "Other" (BR-08).');
    }

    if (!startDate) errors.push('Start Date is mandatory.');
    if (!endDate) errors.push('End Date is mandatory.');

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e < s) {
        errors.push('End Date cannot be earlier than Start Date (BR-05).');
      }

      const isSameDate = startDate === endDate;

      // Half day allowed ONLY when Start Date and End Date are identical
      if ((duration === 'HALF_DAY_FIRST_HALF' || duration === 'HALF_DAY_SECOND_HALF') && !isSameDate) {
        errors.push('Half-day leave is allowed only when Start Date and End Date are identical (BR-06).');
      }

      // If multiple dates are selected, only Full Day can be selected
      if (!isSameDate && duration !== 'FULL_DAY') {
        errors.push('If multiple dates are selected, only Full Day can be selected (SRS 4.5).');
      }
    }

    if (!reason.trim()) {
      errors.push('Reason for Leave is mandatory and cannot be empty.');
    }

    return errors;
  }, [
    selectedEmpId,
    selectedEmpName,
    selectedEmpEmail,
    managerEmail,
    leaveType,
    otherNote,
    startDate,
    endDate,
    duration,
    reason,
  ]);

  // Calculate day count preview
  const calculatedDays = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e < s) return 0;

    if (duration === 'HALF_DAY_FIRST_HALF' || duration === 'HALF_DAY_SECOND_HALF') {
      return 0.5;
    }

    const diff = Math.abs(e.getTime() - s.getTime());
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate, duration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (validationErrors.length > 0) {
      error(validationErrors[0]);
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.leaves.submit({
        employeeId: selectedEmpId,
        employeeName: selectedEmpName,
        employeeEmail: selectedEmpEmail,
        managerEmail,
        leaveType,
        otherNote: leaveType === 'OTHER' ? otherNote : undefined,
        startDate,
        endDate,
        duration,
        reason,
      });

      success(`Leave request ${result.requestId} submitted successfully! Notifications sent to Director and HR.`);
      router.push('/my-leaves');
    } catch (err: any) {
      error(err.message || 'Failed to submit leave request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-wrapper">
        <Navbar />

        <main className="page-container" style={{ maxWidth: '960px' }}>
          <div className="page-header">
            <div>
              <h1 className="page-title">Employee Leave Application</h1>
              <p className="page-subtitle">
                Complete all mandatory fields below. Your request will be routed directly to Director and HR.
              </p>
            </div>
          </div>

          <div className="card">
            <form onSubmit={handleSubmit}>
              {/* SECTION 1: EMPLOYEE DETAILS (SRS 4.1, 4.2) */}
              <div style={{ marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid #E8EDF3' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#17223A', marginBottom: '16px' }}>
                  1. Employee Information (Synced with Active Database)
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  {/* Field 1: Employee ID Dropdown */}
                  <div className="form-group">
                    <label className="form-label">
                      Employee ID <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={selectedEmpId}
                      onChange={(e) => handleIdChange(e.target.value)}
                      disabled={loadingEmployees || (user?.role === 'EMPLOYEE')}
                    >
                      {activeEmployees.map((emp) => (
                        <option key={emp.employeeId} value={emp.employeeId}>
                          {emp.employeeId} ({emp.name})
                        </option>
                      ))}
                    </select>
                    <div className="form-helper">SRS 4.1: Active employee IDs from database</div>
                  </div>

                  {/* Field 2: Employee Name Dropdown */}
                  <div className="form-group">
                    <label className="form-label">
                      Employee Name <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={selectedEmpName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      disabled={loadingEmployees || (user?.role === 'EMPLOYEE')}
                    >
                      {activeEmployees.map((emp) => (
                        <option key={emp.employeeId} value={emp.name}>
                          {emp.name}
                        </option>
                      ))}
                    </select>
                    <div className="form-helper">SRS 4.2: Automatically synced with Employee ID</div>
                  </div>

                  {/* Field 3: Employee Email (Locked/Validated) */}
                  <div className="form-group">
                    <label className="form-label">
                      Employee Email ID <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={selectedEmpEmail}
                      readOnly
                      style={{ backgroundColor: '#F6F8FB', color: '#7E8798', cursor: 'not-allowed' }}
                    />
                    <div className="form-helper">Registered corporate email address</div>
                  </div>

                  {/* Field 4: Manager Email ID Dropdown */}
                  <div className="form-group">
                    <label className="form-label">
                      Manager Email ID <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={managerEmail}
                      onChange={(e) => setManagerEmail(e.target.value)}
                    >
                      <option value="director@durozen.in">director@durozen.in (Director Administrator)</option>
                      <option value="hr@durozen.in">hr@durozen.in (HR Administrator)</option>
                    </select>
                    <div className="form-helper">SRS 4.3: Initial options director@durozen.in & hr@durozen.in</div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: LEAVE TYPE & NOTES (SRS 4.4) */}
              <div style={{ marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid #E8EDF3' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#17223A', marginBottom: '16px' }}>
                  2. Leave Category
                </h3>

                <div className="form-group">
                  <label className="form-label">
                    Leave Type <span className="required">*</span>
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                    {[
                      { id: 'CASUAL_LEAVE', label: 'Casual Leave (PL)' },
                      { id: 'SICK_LEAVE', label: 'Sick Leave' },
                      { id: 'EMERGENCY_LEAVE', label: 'Emergency Leave' },
                      { id: 'OTHER', label: 'Other' },
                    ].map((type) => (
                      <label
                        key={type.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '12px 14px',
                          border: leaveType === type.id ? '2px solid #2769D7' : '1px solid #E8EDF3',
                          borderRadius: '6px',
                          background: leaveType === type.id ? '#E9F1FF' : '#FFFFFF',
                          cursor: 'pointer',
                          fontWeight: leaveType === type.id ? 700 : 500,
                          color: leaveType === type.id ? '#2769D7' : '#17223A',
                        }}
                      >
                        <input
                          type="radio"
                          name="leaveType"
                          value={type.id}
                          checked={leaveType === type.id}
                          onChange={(e) => setLeaveType(e.target.value)}
                          style={{ accentColor: '#2769D7' }}
                        />
                        <span>{type.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* SRS 4.4: Other Leave Note (Shown and mandatory only when Other is selected) */}
                {leaveType === 'OTHER' && (
                  <div className="form-group" style={{ marginTop: '16px', background: '#FFF4DF', padding: '16px', borderRadius: '6px', border: '1px solid #fae6be' }}>
                    <label className="form-label" style={{ color: '#D49422' }}>
                      Other Leave Note <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Specify the exact nature of this other leave category..."
                      value={otherNote}
                      onChange={(e) => setOtherNote(e.target.value)}
                      autoFocus
                    />
                    <div className="form-helper" style={{ color: '#D49422' }}>
                      SRS Section 4.4 & BR-08: Mandatory short answer when Leave Type is "Other".
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: DATES & DURATION VALIDATIONS (SRS 4.5) */}
              <div style={{ marginBottom: '24px', paddingBottom: '18px', borderBottom: '1px solid #E8EDF3' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#17223A', marginBottom: '16px' }}>
                  3. Dates & Duration Specification
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">
                      Start Date <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        if (!endDate || endDate < e.target.value) {
                          setEndDate(e.target.value);
                        }
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      End Date <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-input"
                      value={endDate}
                      min={startDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                    <div className="form-helper">Equal to or later than Start Date (BR-05)</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Duration <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    >
                      <option value="FULL_DAY">Full Day</option>
                      <option value="HALF_DAY_FIRST_HALF">Half Day – 1st Half</option>
                      <option value="HALF_DAY_SECOND_HALF">Half Day – 2nd Half</option>
                    </select>
                    <div className="form-helper">
                      Half-day allowed ONLY when Start Date and End Date are identical (BR-06)
                    </div>
                  </div>
                </div>

                {/* Day calculation badge */}
                {calculatedDays > 0 && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', background: '#E3F7F0', borderRadius: '6px', border: '1px solid #c7eee1', color: '#1B9E76', fontSize: '13px', fontWeight: 600 }}>
                    <CheckIcon size={16} /> Total Calculated Leave Duration: <strong>{calculatedDays} Day{calculatedDays > 1 ? 's' : ''}</strong>
                  </div>
                )}
              </div>

              {/* SECTION 4: REASON FOR LEAVE (SRS 4.1) */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#17223A', marginBottom: '16px' }}>
                  4. Reason for Leave
                </h3>

                <div className="form-group">
                  <label className="form-label">
                    Reason for Leave <span className="required">*</span>
                  </label>
                  <textarea
                    className="form-textarea"
                    rows={4}
                    placeholder="Provide a detailed and professional explanation for this leave application..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="form-helper">Mandatory per SRS 4.1; cannot be empty.</div>
                </div>
              </div>

              {/* Live Validation Alert Box if any errors */}
              {validationErrors.length > 0 && (
                <div style={{ padding: '14px 18px', background: '#FEECEF', border: '1px solid #fad2d7', borderRadius: '6px', marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#D75A67', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                    <AlertTriangleIcon size={16} /> Please resolve the following before submission:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '24px', fontSize: '12.5px', color: '#D75A67' }}>
                    {validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Form Action */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={submitting || validationErrors.length > 0}
                >
                  <PlusIcon size={18} />
                  {submitting ? 'Submitting Application...' : 'Submit Leave Application'}
                </button>
              </div>
            </form>
          </div>
        </main>
      </div>
    </div>
  );
}
