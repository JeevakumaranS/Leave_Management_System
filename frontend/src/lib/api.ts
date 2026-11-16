import axios, { type AxiosRequestConfig } from 'axios';
import { notifyLmsDataUpdated } from './data-update-events';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

if (!API_BASE_URL) {
  throw new Error('NEXT_PUBLIC_API_URL must be configured for the frontend.');
}

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}

export interface ReportRecord {
  requestId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  employee: { department: string; designation: string | null };
  leaveType: string;
  otherNote: string | null;
  startDate: string;
  endDate: string;
  duration: string;
  numberOfDays: number;
  reason: string;
  status: string;
  submittedAt: string;
}

const http = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('durozen_token') : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

async function request<T>(endpoint: string, options: AxiosRequestConfig = {}): Promise<T> {
  try {
    const response = await http.request<T>({ url: endpoint, ...options });
    const method = (options.method || 'GET').toString().toUpperCase();
    if (method !== 'GET' && !endpoint.startsWith('/auth/')) {
      notifyLmsDataUpdated();
    }
    return response.data;
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;

    const errorData = error.response?.data ?? {};
    const responseMessage = errorData?.message;
    const message = Array.isArray(responseMessage)
      ? responseMessage.join(', ')
      : responseMessage || error.response?.statusText;
    throw new ApiError(message || 'An unexpected error occurred', error.response?.status ?? 0, errorData);
  }
}

export const api = {
  // Authentication
  auth: {
    login: (identifier: string, password: string) =>
      request<any>('/auth/login', {
        method: 'POST',
        data: { identifier, password },
      }),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      request<{ message: string }>('/auth/change-password', {
        method: 'POST',
        data,
      }),
    me: () => request<any>('/auth/me'),
  },

  // Employees
  employees: {
    getActive: () => request<any[]>('/employees/active'),
    getApprovers: () =>
      request<Array<{ employeeId: string; name: string; email: string; role: 'HR' | 'DIRECTOR' }>>(
        '/employees/approvers',
      ),
    getAll: (params?: {
      search?: string;
      status?: string;
      role?: string;
      page?: number;
      limit?: number;
    }) => {
      const query = new URLSearchParams();
      Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;

        const normalized = String(value).trim();
        if (!normalized || normalized.toLowerCase() === 'undefined') return;

        query.set(key, normalized);
      });
      const q = query.toString();
      return request<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(
        `/employees${q ? `?${q}` : ''}`,
      );
    },
    getById: (id: string) => request<any>(`/employees/${id}`),
    create: (data: any) =>
      request<any>('/employees', {
        method: 'POST',
        data,
      }),
    update: (id: string, data: any) =>
      request<any>(`/employees/${id}`, {
        method: 'PUT',
        data,
      }),
    toggleStatus: (id: string) =>
      request<any>(`/employees/${id}/toggle-status`, {
        method: 'PATCH',
      }),
    delete: (id: string) =>
      request<{ id: string; employeeId: string; name: string }>(`/employees/${id}`, {
        method: 'DELETE',
      }),
  },

  // Leaves
  leaves: {
    submit: (data: any) =>
      request<any>('/leaves', {
        method: 'POST',
        data,
      }),
    getMyLeaves: () => request<any[]>('/leaves/my'),
    getAll: (params?: {
      search?: string;
      status?: string;
      leaveType?: string;
      employeeId?: string;
      startDate?: string;
      endDate?: string;
      month?: number;
      year?: number;
      page?: number;
      limit?: number;
    }) => {
      const query = new URLSearchParams();
      Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.set(key, String(value));
        }
      });
      const q = query.toString();
      return request<{ items: any[]; total: number; page: number; totalPages: number }>(`/leaves/all${q ? `?${q}` : ''}`);
    },
    getById: (id: string) => request<any>(`/leaves/${id}`),
    cancel: (id: string) =>
      request<any>(`/leaves/${id}/cancel`, {
        method: 'POST',
      }),
    getCalendar: (month?: number, year?: number) => {
      const q = new URLSearchParams();
      if (month) q.set('month', month.toString());
      if (year) q.set('year', year.toString());
      const query = q.toString();
      return request<any[]>(`/leaves/calendar${query ? `?${query}` : ''}`);
    },
  },

  // Approvals & Email Link Handling
  approvals: {
    verifyToken: (token: string) => request<any>(`/approvals/verify-token?token=${encodeURIComponent(token)}`),
    decideWithToken: (data: { token: string; action: 'APPROVE' | 'REJECT'; rejectionRemarks?: string }) =>
      request<any>('/approvals/decide-with-token', {
        method: 'POST',
        data,
      }),
    decidePortal: (requestId: string, data: { action: 'APPROVE' | 'REJECT'; rejectionRemarks?: string }) =>
      request<any>(`/approvals/portal-decide/${requestId}`, {
        method: 'POST',
        data,
      }),
  },

  // Reports & Analytics
  reports: {
    getAdminStats: () => request<any>('/reports/dashboard-stats'),
    getEmployeeStats: () => request<any>('/reports/employee-dashboard-stats'),
    getAnalytics: () => request<any>('/reports/analytics'),
    getReportRecords: (filters: {
      search?: string;
      status?: string;
      leaveType?: string;
      dateFrom?: string;
      dateTo?: string;
    }) => {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) query.set(key, value);
      });
      const q = query.toString();
      return request<ReportRecord[]>(`/reports/records${q ? `?${q}` : ''}`);
    },
    exportCsv: (status?: string, year?: number) => {
      const query = new URLSearchParams();
      if (status) query.set('status', status);
      if (year) query.set('year', year.toString());
      const q = query.toString();
      return request<Blob>(`/reports/export-csv${q ? `?${q}` : ''}`, {
        responseType: 'blob',
      });
    },

  },

  // Notifications Log & Audit
  notifications: {
    getLogs: (params?: { requestId?: string; page?: number; limit?: number }) => {
      const query = new URLSearchParams();
      Object.entries(params ?? {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null) query.set(key, String(value));
      });
      const q = query.toString();
      return request<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(
        `/notifications${q ? `?${q}` : ''}`,
      );
    },
    retry: (id: string) =>
      request<{ deliveryStatus: 'SENT' | 'FAILED'; errorMessage: string | null }>(`/notifications/${id}/retry`, {
        method: 'POST',
      }),
  },
};
