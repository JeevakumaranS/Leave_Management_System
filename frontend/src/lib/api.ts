const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('durozen_token') : null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorData: any = {};
    try {
      errorData = await res.json();
    } catch {
      // Not JSON
    }
    const message = errorData.message || (Array.isArray(errorData.message) ? errorData.message.join(', ') : res.statusText);
    throw new ApiError(message || 'An unexpected error occurred', res.status, errorData);
  }

  // Handle empty responses
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return res.text() as any;
}

export const api = {
  // Authentication
  auth: {
    login: (identifier: string, password: string) =>
      request<any>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }),
    quickLogin: (role: 'EMPLOYEE' | 'HR' | 'DIRECTOR') =>
      request<any>('/auth/quick-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      }),
    me: () => request<any>('/auth/me'),
  },

  // Employees
  employees: {
    getActive: () => request<any[]>('/employees/active'),
    getAll: (params?: { search?: string; status?: string; role?: string }) => {
      const q = new URLSearchParams(params as any).toString();
      return request<any[]>(`/employees${q ? `?${q}` : ''}`);
    },
    getById: (id: number) => request<any>(`/employees/${id}`),
    create: (data: any) =>
      request<any>('/employees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: number, data: any) =>
      request<any>(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    toggleStatus: (id: number) =>
      request<any>(`/employees/${id}/toggle-status`, {
        method: 'PATCH',
      }),
  },

  // Leaves
  leaves: {
    submit: (data: any) =>
      request<any>('/leaves', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getMyLeaves: () => request<any[]>('/leaves/my'),
    getAll: (params?: any) => {
      const q = new URLSearchParams(params).toString();
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
        body: JSON.stringify(data),
      }),
    decidePortal: (requestId: string, data: { action: 'APPROVE' | 'REJECT'; rejectionRemarks?: string }) =>
      request<any>(`/approvals/portal-decide/${requestId}`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // Reports & Analytics
  reports: {
    getAdminStats: () => request<any>('/reports/dashboard-stats'),
    getEmployeeStats: () => request<any>('/reports/employee-dashboard-stats'),
    getAnalytics: () => request<any>('/reports/analytics'),
    exportCsvUrl: (status?: string, year?: number) => {
      const q = new URLSearchParams();
      if (status) q.set('status', status);
      if (year) q.set('year', year.toString());
      const query = q.toString();
      return `${API_BASE_URL}/reports/export-csv${query ? `?${query}` : ''}`;
    },
  },

  // Notifications Log & Audit
  notifications: {
    getLogs: (requestId?: string) => {
      const q = requestId ? `?requestId=${encodeURIComponent(requestId)}` : '';
      return request<any[]>(`/notifications${q}`);
    },
    retry: (id: number) =>
      request<any>(`/notifications/${id}/retry`, {
        method: 'POST',
      }),
  },
};
