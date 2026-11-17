'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../lib/auth-context';
import { api, type ReportRecord } from '../../../lib/api';
import { useToast } from '../../../components/Toast';
import { Sidebar } from '../../../components/Sidebar';
import { Navbar } from '../../../components/Navbar';
import { AnimatedSelect } from '../../../components/AnimatedSelect';
import { PAGE_SIZE, PaginationControls } from '../../../components/PaginationControls';
import { ChevronDownIcon, FileExportIcon, FilterIcon, RefreshIcon, SearchIcon, XIcon } from '../../../components/Icons';
import { formatDate, formatDateTime } from '../../../lib/date';
import { useLiveDataRefresh } from '../../../lib/use-live-data-refresh';

type ReportView =
  | 'EMPLOYEE'
  | 'MONTHLY'
  | 'YEARLY'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'TYPE'
  | 'DATE';

type ReportFilters = {
  search: string;
  status: string;
  leaveType: string;
  dateFrom: string;
  dateTo: string;
};

type ReportGroup = {
  label: string;
  sortKey: string;
  employeeId?: string;
  employeeName?: string;
  designation?: string;
  department?: string;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  cancelled: number;
  approvedDays: number;
};

type DisplayRow = Record<string, string | number>;
type Column = { key: string; label: string };

const initialFilters: ReportFilters = {
  search: '',
  status: '',
  leaveType: '',
  dateFrom: '',
  dateTo: '',
};

const reportTabs: { id: ReportView; label: string }[] = [
  { id: 'EMPLOYEE', label: 'Employee-wise' },
  { id: 'MONTHLY', label: 'Monthly' },
  { id: 'YEARLY', label: 'Yearly' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'TYPE', label: 'Leave type-wise' },
  { id: 'DATE', label: 'Date-wise' },
];

const detailColumns: Column[] = [
  { key: 'requestId', label: 'Request ID' },
  { key: 'employeeId', label: 'Employee ID' },
  { key: 'employeeName', label: 'Employee' },
  { key: 'leaveType', label: 'Leave type' },
  { key: 'startDate', label: 'Start date' },
  { key: 'endDate', label: 'End date' },
  { key: 'numberOfDays', label: 'Days' },
  { key: 'status', label: 'Status' },
  { key: 'submittedAt', label: 'Submitted' },
];

function getGroupKey(record: ReportRecord, view: ReportView) {
  const start = new Date(record.startDate);
  if (view === 'EMPLOYEE') return record.employeeId;
  if (view === 'MONTHLY') {
    return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
  }
  if (view === 'YEARLY') return String(start.getFullYear());
  if (view === 'TYPE') return record.leaveType;
  return start.toISOString().slice(0, 10);
}

function getGroupLabel(record: ReportRecord, view: ReportView, key: string) {
  if (view === 'EMPLOYEE') return record.employeeName;
  if (view === 'MONTHLY') {
    return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(
      new Date(record.startDate),
    );
  }
  if (view === 'YEARLY') return key;
  if (view === 'TYPE') return record.leaveType.replace(/_/g, ' ');
  return formatDate(record.startDate);
}

function getGroups(records: ReportRecord[], view: ReportView): ReportGroup[] {
  const groups = new Map<string, ReportGroup>();
  records.forEach((record) => {
    const key = getGroupKey(record, view);
    let group = groups.get(key);
    if (!group) {
      group = {
        label: getGroupLabel(record, view, key),
        sortKey: key,
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        cancelled: 0,
        approvedDays: 0,
      };
      if (view === 'EMPLOYEE') {
        group.employeeId = record.employeeId;
        group.employeeName = record.employeeName;
        group.designation = record.employee?.designation || 'Team Member';
        group.department = record.employee?.department || '';
      }
      groups.set(key, group);
    }

    group.total += 1;
    if (record.status === 'APPROVED') {
      group.approved += 1;
      group.approvedDays += record.numberOfDays;
    } else if (record.status === 'PENDING') {
      group.pending += 1;
    } else if (record.status === 'REJECTED') {
      group.rejected += 1;
    } else if (record.status === 'CANCELLED') {
      group.cancelled += 1;
    }
  });
  return Array.from(groups.values());
}

function getReportTable(
  view: ReportView,
  records: ReportRecord[],
): { columns: Column[]; rows: DisplayRow[] } {
  if (view === 'PENDING' || view === 'APPROVED' || view === 'REJECTED' || view === 'CANCELLED' || view === 'DATE') {
    const rows = records.map((record) => ({
      requestId: record.requestId,
      employeeId: record.employeeId,
      employeeName: record.employeeName,
      leaveType: record.otherNote
        ? `${record.leaveType.replace(/_/g, ' ')}: ${record.otherNote}`
        : record.leaveType.replace(/_/g, ' '),
      startDate: record.startDate,
      endDate: record.endDate,
      numberOfDays: record.numberOfDays,
      status: record.status,
      submittedAt: record.submittedAt,
    }));
    return { columns: detailColumns, rows };
  }

  const groups = getGroups(records, view);
  if (view === 'EMPLOYEE') {
    return {
      columns: [
        { key: 'employeeId', label: 'Employee ID' },
        { key: 'employeeName', label: 'Employee' },
        { key: 'designation', label: 'Designation / Department' },
        { key: 'total', label: 'Requests' },
        { key: 'approved', label: 'Approved' },
        { key: 'pending', label: 'Pending' },
        { key: 'rejected', label: 'Rejected' },
        { key: 'cancelled', label: 'Cancelled' },
        { key: 'approvedDays', label: 'Approved days' },
      ],
      rows: groups.map((group) => ({ ...group })),
    };
  }

  if (view === 'MONTHLY' || view === 'YEARLY') {
    return {
      columns: [
        { key: 'label', label: view === 'MONTHLY' ? 'Month' : 'Year' },
        { key: 'total', label: 'Requests' },
        { key: 'approved', label: 'Approved' },
        { key: 'pending', label: 'Pending' },
        { key: 'rejected', label: 'Rejected' },
        { key: 'cancelled', label: 'Cancelled' },
        { key: 'approvedDays', label: 'Approved days' },
      ],
      rows: groups.map((group) => ({ ...group })),
    };
  }

  return {
    columns: [
      { key: 'label', label: 'Leave type' },
      { key: 'total', label: 'Requests' },
      { key: 'approved', label: 'Approved' },
      { key: 'pending', label: 'Pending' },
      { key: 'rejected', label: 'Rejected' },
      { key: 'cancelled', label: 'Cancelled' },
      { key: 'approvedDays', label: 'Approved days' },
    ],
    rows: groups.map((group) => ({ ...group })),
  };
}

function displayValue(key: string, value: string | number) {
  if ((key === 'startDate' || key === 'endDate') && typeof value === 'string') {
    return formatDate(value);
  }
  if (key === 'submittedAt' && typeof value === 'string') {
    return formatDateTime(value);
  }
  return value;
}

export default function ReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { error } = useToast();
  const errorRef = useRef(error);
  errorRef.current = error;
  const [activeView, setActiveView] = useState<ReportView>('EMPLOYEE');
  const [filters, setFilters] = useState<ReportFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [records, setRecords] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState({ key: 'employeeName', direction: 'asc' as 'asc' | 'desc' });
  const [page, setPage] = useState(1);

  const forcedStatus = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(activeView)
    ? activeView
    : '';
  const activeFilterCount = Object.values(filters).filter((value) => value.trim()).length;
  const reportQueryKey = JSON.stringify({
    status: forcedStatus || filters.status,
    leaveType: filters.leaveType,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  const previousQueryKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if (!isAdmin) {
      router.push('/dashboard');
      return;
    }

    let active = true;
    const queryChanged = previousQueryKeyRef.current !== reportQueryKey;
    previousQueryKeyRef.current = reportQueryKey;
    const timer = window.setTimeout(() => {
      if (queryChanged) {
        setLoading(true);
        setRecords([]);
      }
      api.reports
        .getReportRecords({
          leaveType: filters.leaveType,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          status: forcedStatus || filters.status,
        })
        .then((data) => {
          if (active) setRecords(data);
        })
        .catch((err: Error) => {
          if (!active) return;
          if (queryChanged) {
            errorRef.current(err.message || 'Failed to load report data');
          } else {
            console.error('Automatic report refresh failed.', err);
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    user,
    authLoading,
    isAdmin,
    router,
    filters.status,
    filters.leaveType,
    filters.dateFrom,
    filters.dateTo,
    activeView,
    forcedStatus,
    reportQueryKey,
    refreshKey,
  ]);

  useLiveDataRefresh(
    () => setRefreshKey((current) => current + 1),
    Boolean(user && isAdmin),
  );

  useEffect(() => {
    setPage(1);
  }, [activeView, filters, sort]);

  const searchTerm = filters.search.trim().toLocaleLowerCase();
  const matchingEmployeeIds = searchTerm
    ? new Set(
        records
          .filter((record) =>
            [
              record.employeeId,
              record.employeeName,
              record.employee?.designation,
              record.employee?.department,
            ].some((value) => String(value ?? '').toLocaleLowerCase().includes(searchTerm)),
          )
          .map((record) => record.employeeId),
      )
    : null;
  const matchingRecords = matchingEmployeeIds
    ? records.filter((record) => matchingEmployeeIds.has(record.employeeId))
    : records;
  const { columns, rows } = getReportTable(activeView, matchingRecords);
  const sortedRows = [...rows].sort((left, right) => {
    const leftValue = left[sort.key] ?? '';
    const rightValue = right[sort.key] ?? '';
    let comparison: number;
    if (typeof leftValue === 'number' && typeof rightValue === 'number') {
      comparison = leftValue - rightValue;
    } else {
      comparison = String(leftValue).localeCompare(String(rightValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }
    return sort.direction === 'asc' ? comparison : -comparison;
  });
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const paginatedRows = sortedRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const clearFilters = () => setFilters({ ...initialFilters });

  const changeSort = (key: string) => {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const changeView = (view: ReportView) => {
    setActiveView(view);
    if (view === 'EMPLOYEE') setSort({ key: 'employeeName', direction: 'asc' });
    else if (view === 'MONTHLY' || view === 'YEARLY') {
      setSort({ key: 'sortKey', direction: 'desc' });
    } else if (view === 'TYPE') setSort({ key: 'label', direction: 'asc' });
    else setSort({ key: 'startDate', direction: 'desc' });
  };

  const exportCsv = () => {
    const escapeCell = (value: string | number) => {
      let text = String(value ?? '');
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [
      columns.map((column) => escapeCell(column.label)).join(','),
      ...sortedRows.map((row) =>
        columns.map((column) => escapeCell(row[column.key] ?? '')).join(','),
      ),
    ].join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leave-report-${activeView.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
              <h1 className="page-title">Leave Reports</h1>
              <p className="page-subtitle">
                Search, filter, sort, and export HR and Director leave reports.
              </p>
            </div>
            <div className="reports-header-actions">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className="btn btn-secondary btn-sm reports-filter-toggle"
                aria-expanded={filtersOpen}
                aria-controls="reports-filters"
                title={activeFilterCount ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} applied` : 'Toggle filters'}
              >
                <FilterIcon size={15} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="reports-filter-badge" aria-label={`${activeFilterCount} filters applied`}>
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDownIcon
                  size={14}
                  style={{
                    transform: filtersOpen ? 'rotate(180deg)' : undefined,
                    transition: 'transform 150ms ease',
                  }}
                />
              </button>
              <button
                type="button"
                onClick={() => setRefreshKey((current) => current + 1)}
                className="btn btn-secondary btn-sm"
              >
                <RefreshIcon size={14} /> Refresh
              </button>
              <button type="button" onClick={exportCsv} className="btn btn-teal btn-sm" disabled={loading}>
                <FileExportIcon size={16} /> Export CSV
              </button>
            </div>
          </div>

          {filtersOpen && <section id="reports-filters" className="card reports-filters-card" style={{ marginBottom: 18 }}>
            <div style={{ overflowX: 'auto', padding: 12 }}>
              <div className="reports-filter-grid">
              <label>
                <span className="form-label">Report view</span>
                <AnimatedSelect
                  value={activeView}
                  onChange={(value) => {
                    const selectedView = reportTabs.find((tab) => tab.id === value);
                    if (selectedView) changeView(selectedView.id);
                  }}
                >
                  {reportTabs.map((tab) => (
                    <option key={tab.id} value={tab.id}>
                      {tab.label}
                    </option>
                  ))}
                </AnimatedSelect>
              </label>
              <label>
                <span className="form-label">Search</span>
                <div className="reports-search-field">
                  <SearchIcon size={16} color="#758195" className="reports-search-icon" />
                  <input
                    className="form-input"
                    value={filters.search}
                    placeholder="Search employee, ID, designation, or department"
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, search: event.target.value }))
                    }
                  />
                </div>
              </label>
              <label>
                <span className="form-label">Status</span>
                <AnimatedSelect
                  value={forcedStatus || filters.status}
                  disabled={Boolean(forcedStatus)}
                  onChange={(value) =>
                    setFilters((current) => ({ ...current, status: value }))
                  }
                >
                  <option value="">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </AnimatedSelect>
              </label>
              <label>
                <span className="form-label">Leave type</span>
                <AnimatedSelect
                  value={filters.leaveType}
                  onChange={(value) =>
                    setFilters((current) => ({ ...current, leaveType: value }))
                  }
                >
                  <option value="">All leave types</option>
                  <option value="CASUAL_LEAVE">Casual leave</option>
                  <option value="SICK_LEAVE">Sick leave</option>
                  <option value="EMERGENCY_LEAVE">Emergency leave</option>
                  <option value="OTHER">Other</option>
                </AnimatedSelect>
              </label>
              <label>
                <span className="form-label">From date</span>
                <input
                  className="form-input"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, dateFrom: event.target.value }))
                  }
                />
              </label>
              <label>
                <span className="form-label">To date</span>
                <input
                  className="form-input"
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, dateTo: event.target.value }))
                  }
                />
              </label>
              <button
                type="button"
                onClick={clearFilters}
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
              >
                <XIcon size={14} /> Clear
              </button>
              </div>
            </div>
          </section>}

          <section className="card">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} aria-sort={sort.key === column.key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                        <button
                          type="button"
                          onClick={() => changeSort(column.key)}
                          style={{
                            background: 'none',
                            border: 0,
                            color: 'inherit',
                            cursor: 'pointer',
                            font: 'inherit',
                            fontWeight: 700,
                            padding: 0,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {column.label}
                          {sort.key === column.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={columns.length} style={{ textAlign: 'center', padding: 36 }}>
                        Loading report data...
                      </td>
                    </tr>
                  ) : sortedRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} style={{ textAlign: 'center', padding: 36, color: '#758195' }}>
                        No leave records match the selected filters.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, index) => (
                      <tr key={String(row.requestId || row.employeeId || row.sortKey || row.label || index)}>
                        {columns.map((column) => (
                          <td key={column.key}>
                            {activeView === 'EMPLOYEE' && column.key === 'designation' ? (
                              <>
                                <div>{row.designation || 'Team Member'}</div>
                                <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                  {row.department}
                                </div>
                              </>
                            ) : (
                              displayValue(column.key, row[column.key] ?? '')
                            )}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!loading && sortedRows.length > 0 && (
              <PaginationControls
                currentPage={page}
                totalItems={sortedRows.length}
                onPageChange={setPage}
              />
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
