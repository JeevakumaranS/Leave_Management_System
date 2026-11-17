'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/api';
import { useToast } from '../../components/Toast';
import { Sidebar } from '../../components/Sidebar';
import { Navbar } from '../../components/Navbar';
import { CheckIcon, AlertTriangleIcon, PlusIcon } from '../../components/Icons';
import { getReasonTextError, normalizeReasonText } from '../../lib/reason-validation';
import { useLiveDataRefresh } from '../../lib/use-live-data-refresh';

export default function ApplyLeavePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { success, error } = useToast();
  const isEmployee = user?.role === 'EMPLOYEE';

  const [activeEmployees, setActiveEmployees] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [approvers, setApprovers] = useState<
    Array<{ employeeId: string; name: string; email: string; role: 'HR' | 'DIRECTOR' }>
  >([]);
  const [loadingApprovers, setLoadingApprovers] = useState(true);

  // Form State
  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedEmpName, setSelectedEmpName] = useState('');
  const [selectedEmpEmail, setSelectedEmpEmail] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [leaveType, setLeaveType] = useState('CASUAL_LEAVE');
  const [otherNote, setOtherNote] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState('FULL_DAY');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }

    loadActiveEmployees();
    loadApprovers();
  }, [user, authLoading]);

  const loadActiveEmployees = async (silent = false) => {
    if (!silent) setLoadingEmployees(true);
    try {
      const list = await api.employees.getActive();
      setActiveEmployees(list);
      const selectedEmployee =
        list.find((employee: any) => employee.employeeId === selectedEmpId) ||
        list.find((employee: any) => employee.employeeId === user?.employeeId) ||
        list[0];
      if (selectedEmployee) selectEmployeeRecord(selectedEmployee);
      else {
        setSelectedEmpId('');
        setSelectedEmpName('');
        setSelectedEmpEmail('');
      }
    } catch (err: any) {
      if (silent) throw err;
      error(err.message || 'Failed to load active employees list');
    } finally {
      if (!silent) setLoadingEmployees(false);
    }
  };

  const loadApprovers = async (silent = false) => {
    if (!silent) setLoadingApprovers(true);
    try {
      const list = await api.employees.getApprovers();
      setApprovers(list);
      setManagerEmail((current) => {
        if (list.some((approver) => approver.email === current)) return current;
        return list.find((approver) => approver.role === 'DIRECTOR')?.email ?? list[0]?.email ?? '';
      });
    } catch (err: any) {
      if (silent) throw err;
      setApprovers([]);
      setManagerEmail('');
      error(err.message || 'Failed to load active managers and HR accounts');
    } finally {
      if (!silent) setLoadingApprovers(false);
    }
  };

  useLiveDataRefresh(
    async () => {
      await Promise.all([loadActiveEmployees(true), loadApprovers(true)]);
    },
    Boolean(user),
  );

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

    if (leaveType === 'OTHER') {
      const otherNoteError = getReasonTextError(otherNote, 'Other Leave Note', 25);
      if (otherNoteError) errors.push(otherNoteError);
    }

    if (!startDate) errors.push('Start Date is mandatory.');
    if (!endDate) errors.push('End Date is mandatory.');

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e < s) {
        errors.push('End Date cannot be earlier than Start Date.');
      }

      const isSameDate = startDate === endDate;

      // Half day allowed ONLY when Start Date and End Date are identical
      if ((duration === 'HALF_DAY_FIRST_HALF' || duration === 'HALF_DAY_SECOND_HALF') && !isSameDate) {
        errors.push('Half-day leave is allowed only when Start Date and End Date are identical.');
      }

      // If multiple dates are selected, only Full Day can be selected
      if (!isSameDate && duration !== 'FULL_DAY') {
        errors.push('If multiple dates are selected, only Full Day can be selected.');
      }
    }

    const reasonError = getReasonTextError(reason, 'Reason for Leave');
    if (reasonError) errors.push(reasonError);

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
  const isSingleDayLeave = Boolean(startDate && endDate && startDate === endDate);

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
        otherNote: leaveType === 'OTHER' ? normalizeReasonText(otherNote) : undefined,
        startDate,
        endDate,
        duration,
        reason: normalizeReasonText(reason),
      });

      success(`Leave request ${result.requestId} submitted successfully.`);
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
                  {/* Field 1: Employee ID */}
                  <div className="form-group">
                    <label className="form-label">
                      Employee ID
                    </label>
                    {isEmployee ? (
                      <input
                        className="form-input"
                        value={selectedEmpId}
                        disabled
                        style={{ backgroundColor: '#F6F8FB', color: '#7E8798', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <select
                        className="form-select"
                        value={selectedEmpId}
                        onChange={(e) => handleIdChange(e.target.value)}
                        disabled={loadingEmployees}
                      >
                        {activeEmployees.map((emp) => (
                          <option key={emp.employeeId} value={emp.employeeId}>
                            {emp.employeeId} ({emp.name})
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="form-helper">Active employee ID</div>
                  </div>

                  {/* Field 2: Employee Name */}
                  <div className="form-group">
                    <label className="form-label">
                      Employee Name
                    </label>
                    {isEmployee ? (
                      <input
                        className="form-input"
                        value={selectedEmpName}
                        disabled
                        style={{ backgroundColor: '#F6F8FB', color: '#7E8798', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <select
                        className="form-select"
                        value={selectedEmpName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        disabled={loadingEmployees}
                      >
                        {activeEmployees.map((emp) => (
                          <option key={emp.employeeId} value={emp.name}>
                            {emp.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="form-helper">
                      {isEmployee ? 'Synced with your account' : 'Synced with selected Employee ID'}
                    </div>
                  </div>

                  {/* Field 3: Employee Email (Locked/Validated) */}
                  <div className="form-group">
                    <label className="form-label">
                      Employee Email ID
                    </label>
                    <input
                      type="email"
                      className="form-input"
                      value={selectedEmpEmail}
                      readOnly
                      disabled={isEmployee}
                      style={{
                        backgroundColor: '#F6F8FB',
                        color: '#7E8798',
                        cursor: 'not-allowed',
                      }}
                    />
                    <div className="form-helper">Registered corporate email address</div>
                  </div>

                  {/* Field 4: Manager / HR Name and Email */}
                  <div className="form-group">
                    <label className="form-label">
                      Manager / HR Name &amp; Email <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={managerEmail}
                      required
                      disabled={loadingApprovers || approvers.length === 0}
                      onChange={(e) => setManagerEmail(e.target.value)}
                    >
                      <option value="">
                        {loadingApprovers ? 'Loading managers and HR...' : 'No active managers or HR found'}
                      </option>
                      {approvers.map((approver) => (
                        <option key={approver.employeeId} value={approver.email}>
                          {approver.name} ({approver.role === 'DIRECTOR' ? 'Director' : 'HR'}) — {approver.email}
                        </option>
                      ))}
                    </select>
                    <div className="form-helper">Select an active manager or HR account.</div>
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
                      onBlur={(e) => setOtherNote(normalizeReasonText(e.target.value))}
                      minLength={3}
                      maxLength={25}
                      autoFocus
                    />
                    <div className="form-helper" style={{ color: '#D49422' }}>
                      Enter 3–25 characters using letters, numbers, spaces, or basic punctuation.
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: DATES & DURATION VALIDATIONS */}
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
                        const nextStartDate = e.target.value;
                        const nextEndDate = !endDate || endDate < nextStartDate ? nextStartDate : endDate;
                        setStartDate(nextStartDate);
                        setEndDate(nextEndDate);
                        if (nextStartDate !== nextEndDate) setDuration('FULL_DAY');
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
                      onChange={(e) => {
                        const nextEndDate = e.target.value;
                        setEndDate(nextEndDate);
                        if (nextEndDate !== startDate) setDuration('FULL_DAY');
                      }}
                    />
                    <div className="form-helper">Must be equal to or later than Start Date</div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Duration <span className="required">*</span>
                    </label>
                    <select
                      className="form-select"
                      value={duration}
                      disabled={!isSingleDayLeave}
                      onChange={(e) => setDuration(e.target.value)}
                    >
                      <option value="FULL_DAY">Full Day</option>
                      {isSingleDayLeave && (
                        <>
                          <option value="HALF_DAY_FIRST_HALF">Half Day – 1st Half</option>
                          <option value="HALF_DAY_SECOND_HALF">Half Day – 2nd Half</option>
                        </>
                      )}
                    </select>
                    <div className="form-helper">
                      {isSingleDayLeave
                        ? 'Half-day options are available for a one-day leave.'
                        : 'Select the same start and end date to enable half-day options.'}
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

              {/* SECTION 4: REASON FOR LEAVE */}
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
                    onBlur={(e) => setReason(normalizeReasonText(e.target.value))}
                    minLength={3}
                    maxLength={250}
                  />
                  <div className="form-helper">
                    Enter 3–250 characters using letters, numbers, spaces, or basic punctuation.
                  </div>
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
              <div className="leave-form-actions">
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
